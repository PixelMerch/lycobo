import type postgres from "postgres";
import { z } from "zod";
import type { imageSettlement } from "../images/image-settlement";

const charge = z.object({
  itemId: z.uuid(),
  jobId: z.uuid(),
  provider: z.string(),
  accountId: z.string(),
  approval: z.string(),
  amount: z.number().int().positive(),
  state: z.enum(["debit", "reverse"]),
  transactionId: z.string().nullable(),
  token: z.uuid(),
});
type Charge = z.infer<typeof charge>;

/** 扣费和退回均完成后定向通知积分账户本人。 */
async function notifyWallet(tx: postgres.TransactionSql, work: Charge) {
  await tx`insert into realtime_outbox (channel,user_id,event)
    select j.organization_id::text,c.user_id,jsonb_build_object('id',gen_random_uuid(),'kind','wallet')
    from generation_jobs j join generation_credit_charges c on c.item_id=${work.itemId}
    where j.id=${work.jobId}`;
}

async function recordCreditMovement(
  tx: postgres.TransactionSql,
  work: Charge,
  kind: "consume" | "refund",
  amount: number,
) {
  await tx`insert into billing_credit_entries (provider,organization_id,user_id,kind,amount,item_id)
    select ${work.provider},j.organization_id,c.user_id,${kind},${amount},${work.itemId}
    from generation_jobs j join generation_credit_charges c on c.item_id=${work.itemId}
    where j.id=${work.jobId}
    on conflict (item_id,kind) do nothing`;
}

async function acceptCharge(
  tx: postgres.TransactionSql,
  work: Charge,
  active: boolean,
  transactionId: string,
) {
  await tx`update generation_credit_charges set transaction_id=${transactionId},
    state=${active ? "paid" : "reverse"},next_attempt_at=now(),lease_token=null where item_id=${work.itemId}`;
  if (active)
    await tx`insert into generation_outbox (item_id) values (${work.itemId}) on conflict do nothing`;
  await recordCreditMovement(tx, work, "consume", -work.amount);
  await notifyWallet(tx, work);
}

/** 领取已持久化的扣费意图，并在确认扣费后原子写入生成 outbox。 */
export function generationCharges(
  sql: postgres.Sql,
  refreshJob: ReturnType<typeof imageSettlement>["refreshJob"],
) {
  return {
    async leaseGenerationCharges(provider: string, jobId?: string) {
      const rows = await sql`with due as (
        select c.item_id,i.job_id from generation_credit_charges c join generation_job_items i on i.id=c.item_id
        where c.provider=${provider} and c.state in ('debit','reverse') and c.next_attempt_at<=now()
        and not exists(select 1 from generation_credit_charges prior
          where prior.item_id=c.previous_item_id and prior.state in ('debit','paid','reverse'))
        ${jobId ? sql`and i.job_id=${jobId}` : sql``}
        order by c.next_attempt_at,c.item_id limit 4 for update of c skip locked
      ) update generation_credit_charges c set lease_token=gen_random_uuid(),next_attempt_at=now()+interval '40 seconds'
        from due where c.item_id=due.item_id
        returning c.item_id as "itemId",due.job_id as "jobId",c.provider,c.account_id as "accountId",
          c.approval,c.amount,c.state,c.transaction_id as "transactionId",c.lease_token as token`;
      return z.array(charge).parse(rows);
    },
    async finishGenerationCharge(
      work: Charge,
      result: { transactionId: string } | { declined: string } | { reversed: true },
    ) {
      await sql.begin(async (tx) => {
        // 与图片终态、人工核对和重试保持同一锁顺序。
        await tx`select id from generation_jobs where id=${work.jobId} for update`;
        const [item] =
          await tx`select status,superseded_at from generation_job_items where id=${work.itemId} for update`;
        const [current] = await tx`select item_id from generation_credit_charges
          where item_id=${work.itemId} and state=${work.state} and lease_token=${work.token} for update`;
        if (!current || !item) return;
        if ("transactionId" in result) {
          const active = item.status === "queued" && !item.superseded_at;
          await acceptCharge(tx, work, active, result.transactionId);
        } else if ("reversed" in result) {
          await tx`update generation_credit_charges set state='reversed',lease_token=null where item_id=${work.itemId}`;
          await recordCreditMovement(tx, work, "refund", work.amount);
          await notifyWallet(tx, work);
        } else {
          await tx`update generation_credit_charges set state='declined',lease_token=null where item_id=${work.itemId}`;
          await tx`update generation_job_items set status='failed',error_code=${result.declined},completed_at=now()
            where id=${work.itemId} and status='queued' and superseded_at is null`;
          await refreshJob(tx, work.jobId);
        }
      });
    },
  };
}

/** 外部账本的消费按原交易冲正，禁止写本地退款流水。 */
export async function requestCreditReversal(tx: postgres.TransactionSql, itemId: string) {
  const [chargeRow] =
    await tx`select state from generation_credit_charges where item_id=${itemId} for update`;
  if (!chargeRow) return false;
  if (chargeRow.state === "paid")
    await tx`update generation_credit_charges set state='reverse',next_attempt_at=now(),lease_token=null where item_id=${itemId}`;
  return true;
}
