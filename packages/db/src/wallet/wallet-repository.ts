import type { ImageScope, walletHistorySchema } from "@lycoboai/contracts";
import type postgres from "postgres";
import { z } from "zod";

export class WalletError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

type WalletHistoryRow = ReturnType<typeof walletHistorySchema.parse>["data"][number] & {
  cursor: string;
};
/** 校验成员身份并锁定工作区钱包，供认证请求写入积分。 */
export async function ensureWallet(tx: postgres.TransactionSql, scope: ImageScope) {
  const members =
    await tx`select user_id from organization_members where organization_id=${scope.organizationId} and user_id=${scope.userId} for share`;
  if (!members.length) throw new WalletError("FORBIDDEN");
  return lockOrganizationWallet(tx, scope.organizationId);
}

/** 锁定已确认归属的工作区钱包，例如验签成功且匹配的原始付款订单。 */
export async function lockOrganizationWallet(tx: postgres.TransactionSql, organizationId: string) {
  await tx`insert into organization_wallets (organization_id)
    values (${organizationId}) on conflict (organization_id) do nothing`;
  const [wallet] = await tx`select id,balance from organization_wallets
    where organization_id=${organizationId} for update`;
  return z.object({ id: z.uuid(), balance: z.number().int().nonnegative() }).parse(wallet);
}
/** 持有钱包行锁时写入幂等流水，并在同一事务中更新余额。 */
export async function appendWalletEntry(
  tx: postgres.TransactionSql,
  walletId: string,
  entry: {
    eventKey: string;
    kind: "opening" | "consume" | "refund" | "recharge";
    amount: number;
    userId: string;
    jobId?: string;
    itemId?: string;
    rechargeId?: string;
    billingOrderId?: string;
  },
) {
  const [prior] =
    await tx`select id from wallet_entries where wallet_id=${walletId} and event_key=${entry.eventKey}`;
  if (prior) return false;
  const [balance] =
    await tx`update organization_wallets set balance=balance+${entry.amount},updated_at=now()
    where id=${walletId} and balance+${entry.amount}>=0 returning balance`;
  if (!balance) throw new WalletError("INSUFFICIENT_CREDITS");
  await tx`insert into wallet_entries (wallet_id,event_key,kind,amount,balance_after,user_id,job_id,item_id,recharge_id,billing_order_id)
    values (${walletId},${entry.eventKey},${entry.kind},${entry.amount},${balance.balance},${entry.userId},
      ${entry.jobId ?? null},${entry.itemId ?? null},${entry.rechargeId ?? null},${entry.billingOrderId ?? null})`;
  return true;
}
function checkRechargeOrder(
  order: postgres.Row | undefined,
  input: { amountMinor: number; currency: string; channel: string },
) {
  if (
    !order ||
    order.amount_minor !== input.amountMinor ||
    order.currency !== input.currency ||
    order.channel !== input.channel
  )
    throw new WalletError("STATE_CONFLICT");
  return order;
}

/** 读取企业积分流水和充值订单，按幂等规则记录充值到账。 */
export function walletRepository(sql: postgres.Sql) {
  return {
    async wallet(scope: ImageScope) {
      const [row] =
        await sql`select balance from organization_wallets where organization_id=${scope.organizationId}`;
      return {
        balance: z
          .number()
          .int()
          .nonnegative()
          .parse(row?.balance ?? 0),
      };
    },
    async walletEntries(
      scope: ImageScope,
      limit: number,
      before?: string,
      view?: "spent" | "earned",
    ) {
      // 弹窗按类别查询最近六个月，账户设置仍使用完整流水。
      const recent = view
        ? sql`and (e.kind = 'consume') = ${view === "spent"} and e.created_at >= now() - interval '6 months'`
        : sql``;
      return sql`select e.id::text,u.uid as user_uid,e.kind,e.amount,e.balance_after,e.job_id,j.public_id as task_id,e.item_id,
        coalesce(e.recharge_id,e.billing_order_id) as recharge_id,e.created_at
        from wallet_entries e join organization_wallets w on w.id=e.wallet_id left join generation_jobs j on j.id=e.job_id left join users u on u.id=e.user_id
        where w.organization_id=${scope.organizationId}
        ${recent}
        ${before ? sql`and e.id < ${before}::bigint` : sql``} order by e.id desc limit ${limit}`;
    },
    /** 合并当前工作区站内流水与当前用户在该工作区的购买流水。 */
    async walletHistory(
      scope: ImageScope,
      limit: number,
      view?: "spent" | "earned",
      before?: [createdAt: string, ledger: string, entryId: string],
    ) {
      const recent = view
        ? sql`and (kind = 'consume') = ${view === "spent"} and created_at >= now() - interval '6 months'`
        : sql``;
      // 两边的主键可能相同，游标保留账本序号和 PostgreSQL 的微秒精度。
      const cursor = before
        ? sql`and (created_at,ledger,entry_id)<(${before[0]}::timestamptz,${before[1]}::integer,${before[2]}::bigint)`
        : sql``;
      // 买家看到同一订单的合计到账额，其他工作区成员只看到共享的赠送积分。
      const rows = await sql<WalletHistoryRow[]>`
        with history as (
          select 0 as ledger,e.id as entry_id,u.uid as user_uid,e.kind::text as kind,e.amount,
            e.job_id,j.public_id as task_id,e.item_id,coalesce(e.recharge_id,e.billing_order_id) as recharge_id,e.created_at
          from wallet_entries e join organization_wallets w on w.id=e.wallet_id
          left join generation_jobs j on j.id=e.job_id left join users u on u.id=e.user_id
          where w.organization_id=${scope.organizationId}
            and not exists (
              select 1 from billing_credit_entries paid where paid.order_id=e.billing_order_id
              and paid.organization_id=w.organization_id and paid.user_id=${scope.userId}
            )
          union all
          select 1,e.id,u.uid,e.kind,e.amount+coalesce(bonus.amount,0),j.id,j.public_id,e.item_id,e.order_id,e.created_at
          from billing_credit_entries e join users u on u.id=e.user_id
          left join wallet_entries bonus on bonus.billing_order_id=e.order_id and bonus.user_id=e.user_id
          left join generation_job_items i on i.id=e.item_id left join generation_jobs j on j.id=i.job_id
          where e.organization_id=${scope.organizationId} and e.user_id=${scope.userId}
        )
        select concat(ledger,':',entry_id) as id,user_uid,kind,amount,job_id,task_id,item_id,recharge_id,
          to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as created_at,
          concat(to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'/',ledger,'/',entry_id) as cursor
        from history where true ${recent} ${cursor}
        order by history.created_at desc,ledger desc,entry_id desc limit ${limit + 1}`;
      const page = rows.slice(0, limit);
      return {
        data: page.map(({ cursor: _cursor, ...entry }) => entry),
        nextCursor: (rows.length > limit ? page.at(-1)?.cursor : null) ?? null,
      };
    },
    async rechargeOrders(scope: ImageScope, limit: number, before?: string) {
      return sql`select r.id,u.uid as user_uid,r.credits,r.amount_minor,r.currency,r.status,r.channel,r.created_at,r.paid_at
        from recharge_orders r join organization_wallets w on w.id=r.wallet_id join users u on u.id=r.user_id
        where w.organization_id=${scope.organizationId}
        ${before ? sql`and (r.created_at,r.id)<(select created_at,id from recharge_orders where id=${before} and wallet_id=w.id)` : sql``}
        order by r.created_at desc,r.id desc limit ${limit}`;
    },
    // 只允许内部支付适配器创建充值单，浏览器不能指定到账积分或结算。
    async createRecharge(scope: ImageScope, raw: unknown) {
      const input = z
        .strictObject({
          key: z.uuid(),
          credits: z.number().int().min(1).max(10000000),
          amountMinor: z.number().int().min(1).max(100000000),
          channel: z.string().regex(/^[a-z0-9_-]{1,40}$/),
        })
        .parse(raw);
      return sql.begin(async (tx) => {
        const wallet = await ensureWallet(tx, scope);
        const [order] =
          await tx`insert into recharge_orders (wallet_id,user_id,idempotency_key,credits,amount_minor,channel)
          values (${wallet.id},${scope.userId},${input.key},${input.credits},${input.amountMinor},${input.channel})
          on conflict (wallet_id,idempotency_key) do nothing returning id`;
        if (order) return { id: String(order.id), replayed: false };
        const [existing] =
          await tx`select * from recharge_orders where wallet_id=${wallet.id} and idempotency_key=${input.key}`;
        if (
          !existing ||
          existing.credits !== input.credits ||
          existing.amount_minor !== input.amountMinor ||
          existing.channel !== input.channel
        )
          throw new WalletError("IDEMPOTENCY_CONFLICT");
        return { id: String(existing.id), replayed: true };
      });
    },
    // 调用前由可信支付适配器验证支付签名与商户身份。
    async settleRecharge(raw: unknown) {
      const input = z
        .strictObject({
          id: z.uuid(),
          transactionId: z.string().min(1).max(200),
          channel: z.string().min(1).max(40),
          amountMinor: z.number().int().positive(),
          currency: z.literal("CNY"),
        })
        .parse(raw);
      return sql.begin(async (tx) => {
        const [candidate] =
          await tx`select w.organization_id,r.user_id from recharge_orders r join organization_wallets w on w.id=r.wallet_id where r.id=${input.id}`;
        if (!candidate) throw new WalletError("NOT_FOUND");
        const wallet = await ensureWallet(tx, {
          organizationId: String(candidate.organization_id),
          userId: String(candidate.user_id),
        });
        const [order] = await tx`select * from recharge_orders where id=${input.id} for update`;
        const orderForSettlement = checkRechargeOrder(order, input);
        if (orderForSettlement.status === "paid") {
          if (orderForSettlement.provider_transaction_id !== input.transactionId)
            throw new WalletError("STATE_CONFLICT");
          return { replayed: true };
        }
        if (orderForSettlement.status !== "pending") throw new WalletError("STATE_CONFLICT");
        await tx`update recharge_orders set status='paid',provider_transaction_id=${input.transactionId},paid_at=now() where id=${input.id}`;
        await appendWalletEntry(tx, wallet.id, {
          eventKey: `recharge:${input.id}`,
          kind: "recharge",
          amount: Number(orderForSettlement.credits),
          userId: String(candidate.user_id),
          rechargeId: input.id,
        });
        return { replayed: false };
      });
    },
  };
}
