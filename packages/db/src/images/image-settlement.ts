import type postgres from "postgres";
import { appendWalletEntry, ensureWallet } from "../wallet/wallet-repository";
import { recordImageEvent } from "./image-event-repository";

export function imageSettlement(sql: postgres.Sql, tasksSince?: Date) {
  const refreshJob = async (tx: postgres.TransactionSql, jobId: string) => {
    await tx`update generation_jobs j set status = case
      when exists(select 1 from generation_job_items i where i.job_id=j.id and i.superseded_at is null and i.status='running') then 'running'
      when exists(select 1 from generation_job_items i where i.job_id=j.id and i.superseded_at is null and i.status='queued') then 'queued'
      when exists(select 1 from generation_job_items i where i.job_id=j.id and i.superseded_at is null and i.status='needs_reconciliation') then 'needs_reconciliation'
      when not exists(select 1 from generation_job_items i where i.job_id=j.id and i.superseded_at is null and i.status <> 'succeeded') then 'succeeded'
      when exists(select 1 from generation_job_items i where i.job_id=j.id and i.superseded_at is null and i.status='succeeded') then 'partially_failed'
      else 'failed' end, updated_at=now(), completed_at=case
      when exists(select 1 from generation_job_items i where i.job_id=j.id and i.superseded_at is null and i.status in ('running','queued','needs_reconciliation')) then null
      else now() end where j.id=${jobId}`;
    const [job] = await tx`select organization_id from generation_jobs where id=${jobId}`;
    if (job) await recordImageEvent(tx, String(job.organization_id), "task", jobId);
  };
  const refund = async (tx: postgres.TransactionSql, jobId: string, itemId: string) => {
    const credits =
      await tx`insert into generation_credit_ledger (organization_id,job_id,item_id,event_type,amount)
      select j.organization_id,j.id,${itemId},'refund',coalesce(
        (select -e.amount from wallet_entries e join organization_wallets w on w.id=e.wallet_id
          where e.event_key=${`consume:${itemId}`} and e.job_id=j.id and e.item_id=${itemId}
            and e.kind='consume' and w.organization_id=j.organization_id),j.unit_credits)
        from generation_jobs j where j.id=${jobId}
      on conflict do nothing returning organization_id,amount`;
    const credit = credits[0];
    if (credit) {
      const [job] = await tx`select user_id from generation_jobs where id=${jobId}`;
      if (!job) throw new Error("MISSING_JOB");
      const wallet = await ensureWallet(tx, {
        organizationId: String(credit.organization_id),
        userId: String(job.user_id),
      });
      await appendWalletEntry(tx, wallet.id, {
        eventKey: `refund:${itemId}`,
        kind: "refund",
        amount: Number(credit.amount),
        userId: String(job.user_id),
        jobId,
        itemId,
      });
    }
  };
  const settleInvalidResponses = async () => {
    const rows =
      await sql`select id,job_id from generation_job_items where status='needs_reconciliation' and error_code='PROVIDER_INVALID_IMAGE_RESPONSE' and superseded_at is null ${tasksSince ? sql`and created_at>=${tasksSince}` : sql``} limit 100`;
    for (const row of rows)
      await sql.begin(async (tx) => {
        await tx`select id from generation_jobs where id=${row.job_id} for update`;
        const changed =
          await tx`update generation_job_items set status='failed',reconciliation_evidence='Invalid response: no usable image delivered',completed_at=coalesce(completed_at,now()) where id=${row.id} and status='needs_reconciliation' and error_code='PROVIDER_INVALID_IMAGE_RESPONSE' returning id`;
        if (!changed.length) return;
        await refund(tx, String(row.job_id), String(row.id));
        await refreshJob(tx, String(row.job_id));
      });
  };
  const expireTimedOut = async (organizationId?: string) => {
    const rows = await sql`select i.id,i.job_id from generation_job_items i
      where i.provider<>'fluxport-video' and i.status='running' and i.superseded_at is null and i.started_at<now()-interval '3 minutes' and not exists(select 1 from provider_webhook_tasks w join provider_executions e on e.item_id=w.item_id where w.item_id=i.id and e.phase='polling')
      ${organizationId ? sql`and i.organization_id=${organizationId}` : sql``} ${tasksSince ? sql`and i.created_at>=${tasksSince}` : sql``} limit 100`;
    for (const row of rows)
      await sql.begin(async (tx) => {
        await tx`select id from generation_jobs where id=${row.job_id} for update`;
        const changed =
          await tx`update generation_job_items set status='needs_reconciliation',error_code='PROVIDER_TIMEOUT',completed_at=now()
        where provider<>'fluxport-video' and id=${row.id} and status='running' and superseded_at is null and started_at<now()-interval '3 minutes' and not exists(select 1 from provider_webhook_tasks w join provider_executions e on e.item_id=w.item_id where w.item_id=generation_job_items.id and e.phase='polling') returning id`;
        if (changed.length) await refreshJob(tx, String(row.job_id));
      });
  };
  return { refreshJob, refund, expireTimedOut, settleInvalidResponses };
}
