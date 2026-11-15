import { randomUUID } from "node:crypto";
import {
  type ImageScope,
  imageGenerationInputSchema,
  providerSnapshotSchema,
  type StoredImage,
} from "@lycoboai/contracts";
import type postgres from "postgres";
import { recordImageEvent } from "./image-event-repository";

import {
  type ClaimedImage,
  ImageRepositoryError,
  type IndependentModelConfiguration,
} from "./image-repository-types";
import type { imageSettlement } from "./image-settlement";

async function leaseProviderExecution(
  tx: postgres.TransactionSql,
  itemId: string,
  leaseMs: number,
  row: {
    provider_snapshot?: unknown;
    deadline_at?: unknown;
    phase?: unknown;
    task_id?: unknown;
    status_path?: unknown;
    poll_failures?: unknown;
  },
): Promise<ClaimedImage["configuredProvider"]> {
  const snapshot = row.provider_snapshot
    ? providerSnapshotSchema.parse(row.provider_snapshot)
    : null;
  if (!snapshot) return undefined;
  const deadlineAt = row.deadline_at
    ? new Date(String(row.deadline_at))
    : new Date(Date.now() + snapshot.taskTimeoutSeconds * 1000);
  await tx`insert into provider_executions(item_id,phase,deadline_at,lease_until) values (${itemId},'submitting',${deadlineAt},now()+${leaseMs}*interval '1 millisecond') on conflict(item_id) do update set lease_until=excluded.lease_until,next_poll_at=case when provider_executions.phase='polling' then provider_executions.next_poll_at else null end,poll_count=provider_executions.poll_count+1`;
  return {
    snapshot,
    phase: String(row.phase ?? "submitting"),
    taskId: row.task_id ? String(row.task_id) : null,
    statusPath: row.status_path ? String(row.status_path) : null,
    deadlineAt,
    pollFailures: Number(row.poll_failures ?? 0),
  };
}

type ImageResult =
  | { image: StoredImage; requestId?: string | undefined }
  | { errorCode: string; unknown: boolean; requestId?: string | undefined };

async function settleImageResult(
  tx: postgres.TransactionSql,
  job: ClaimedImage,
  result: ImageResult,
  refund: ReturnType<typeof imageSettlement>["refund"],
) {
  if ("image" in result) {
    const a = result.image;
    await tx`insert into media_assets (id,organization_id,user_id,kind,media_type,object_key,mime_type,width,height,bytes,sha256)
            values (${a.id},${job.organizationId},${job.userId},'output','image',${a.objectKey},${a.mimeType},${a.width},${a.height},${a.bytes},${a.sha256})`;
    await tx`update generation_job_items set status='succeeded',error_code=null,output_asset_id=${a.id},provider_request_id=coalesce(${result.requestId ?? null},provider_request_id),completed_at=now() where id=${job.itemId}`;
  } else {
    await tx`update generation_job_items set status=${result.unknown && result.errorCode !== "PROVIDER_INVALID_IMAGE_RESPONSE" ? "needs_reconciliation" : "failed"},error_code=${result.errorCode},
            provider_request_id=coalesce(${result.requestId ?? null},provider_request_id),completed_at=now() where id=${job.itemId}`;
    if (!result.unknown || result.errorCode === "PROVIDER_INVALID_IMAGE_RESPONSE")
      await refund(tx, job.jobId, job.itemId);
  }
}

/** 管理生图执行、补投租约及结果结算。 */
export function imageExecutionRepository(
  sql: postgres.Sql,
  settlement: ReturnType<typeof imageSettlement>,
  independent?: IndependentModelConfiguration,
  tasksSince?: Date,
) {
  const { refreshJob, refund } = settlement;
  return {
    async leaseOutbox(transport: "local" | "queue" = "local") {
      return sql.begin(async (tx) => {
        // 为已确认的首次投递预留消费时间，避免积压时反复复制排队消息。
        const recoveryWindow =
          transport === "queue"
            ? tx`and (i.status<>'queued' or o.dispatched_at is null or o.next_attempt_at<=now()-interval '5 minutes')`
            : tx``;
        const rows =
          await tx`select o.id,o.item_id from generation_outbox o join generation_job_items i on i.id=o.item_id
          where ${tasksSince ? sql`i.created_at>=${tasksSince} and` : sql``} (i.status='queued' or (i.status='running' and exists(select 1 from provider_executions e where e.item_id=i.id and e.phase='polling' and e.next_poll_at<=now() and (e.lease_until is null or e.lease_until<now())))) and o.next_attempt_at<=now() and (o.lease_expires_at is null or o.lease_expires_at<now())
          ${recoveryWindow}
          order by o.next_attempt_at limit 20 for update of o skip locked`;
        const result: Array<{ id: string; itemId: string; leaseToken: string }> = [];
        for (const row of rows) {
          const token = randomUUID();
          await tx`update generation_outbox set lease_token=${token},lease_expires_at=now()+interval '30 seconds' where id=${row.id}`;
          result.push({ id: String(row.id), itemId: String(row.item_id), leaseToken: token });
        }
        return result;
      });
    },
    async ackOutbox(id: string, token: string) {
      await sql`update generation_outbox set dispatched_at=coalesce(dispatched_at,now()),next_attempt_at=now()+interval '30 seconds',
        lease_token=null,lease_expires_at=null where id=${id} and lease_token=${token}`;
    },
    async claim(
      itemId: string,
      workerId: string,
      requestedLeaseMs: number,
    ): Promise<ClaimedImage | null> {
      const leaseMs = Math.min(requestedLeaseMs, 90000);
      return sql.begin(async (tx) => {
        const [candidate] =
          await tx`select job_id from generation_job_items where id=${itemId} ${tasksSince ? tx`and created_at>=${tasksSince}` : tx``} and (status='queued' or (status='running' and exists(select 1 from provider_executions e where e.item_id=${itemId} and e.phase='polling' and e.next_poll_at<=now() and (e.lease_until is null or e.lease_until<now()))))`;
        if (!candidate) return null;
        // 与完成结算和人工核对使用相同的加锁顺序，避免同一任务的子项死锁。
        await tx`select id from generation_jobs where id=${candidate.job_id} for update`;
        const [row] =
          await tx`select i.id,i.position,i.job_id,j.organization_id,j.user_id,j.input,j.provider_model,j.provider_snapshot,e.phase,e.task_id,e.status_path,e.deadline_at,e.poll_failures from generation_job_items i join generation_jobs j on j.id=i.job_id left join provider_executions e on e.item_id=i.id
          where i.id=${itemId} and (i.status='queued' or (i.status='running' and e.phase='polling' and e.next_poll_at<=now() and (e.lease_until is null or e.lease_until<now()))) for update of i skip locked`;
        if (!row) return null;
        const input = imageGenerationInputSchema.parse(row.input);
        const executionToken = randomUUID();
        const configuredProvider = await leaseProviderExecution(tx, itemId, leaseMs, row);
        await tx`update generation_job_items set status='running',worker_id=${workerId},execution_token=${executionToken},provider=${configuredProvider?.snapshot.adapter ?? "vakv"},attempts=attempts+case when status='queued' then 1 else 0 end,
          started_at=coalesce(started_at,now()),lease_expires_at=now()+${leaseMs} * interval '1 millisecond' where id=${itemId}`;
        await tx`update generation_jobs set status='running',updated_at=now() where id=${row.job_id}`;
        await recordImageEvent(tx, String(row.organization_id), "task", String(row.job_id));
        return {
          itemId,
          configuredProvider,
          position: Number(row.position),
          executionToken,
          jobId: String(row.job_id),
          organizationId: String(row.organization_id),
          userId: String(row.user_id),
          input,
          providerModel: imageGenerationInputSchema.shape.model.parse(
            row.provider_model ?? input.model,
          ),
        };
      });
    },
    async providerCipher(credentialId: string) {
      if (independent?.credentialId === credentialId) return independent.credentialCipher;
      const [row] = await sql`select ciphertext from model_credentials where id=${credentialId}`;
      if (!row) throw new Error("MODEL_CREDENTIAL_NOT_FOUND");
      return String(row.ciphertext);
    },
    async deferProvider(
      job: ClaimedImage,
      taskId: string,
      statusPath: string,
      delayMs: number,
      failed = false,
      requestId?: string,
    ) {
      return sql.begin(async (tx) => {
        const rows =
          await tx`update generation_job_items set provider_request_id=coalesce(${requestId ?? null},provider_request_id),lease_expires_at=(select deadline_at+interval '1 minute' from provider_executions where item_id=${job.itemId}) where id=${job.itemId} and status='running' and execution_token=${job.executionToken} returning id`;
        if (!rows.length) return;
        await tx`update provider_executions set poll_failures=case when ${failed} then poll_failures+1 else 0 end,phase='polling',task_id=${taskId},status_path=${statusPath},next_poll_at=now()+${Math.max(2000, Math.min(delayMs, 60000))}*interval '1 millisecond',lease_until=null where item_id=${job.itemId}`;
        await tx`update generation_outbox set next_attempt_at=now()+${Math.max(2000, Math.min(delayMs, 60000))}*interval '1 millisecond',lease_token=null,lease_expires_at=null where item_id=${job.itemId}`;
      });
    },
    async finish(job: ClaimedImage, result: ImageResult) {
      return sql.begin(async (tx) => {
        await tx`select id from generation_jobs where id=${job.jobId} for update`;
        const [item] =
          await tx`select status from generation_job_items where id=${job.itemId} and job_id=${job.jobId} and execution_token=${job.executionToken} and superseded_at is null for update`;
        if (
          item?.status !== "running" &&
          !(item?.status === "needs_reconciliation" && "image" in result)
        )
          return false;
        await settleImageResult(tx, job, result, refund);
        await refreshJob(tx, job.jobId);
        return true;
      });
    },
    ...imageExecutionMaintenance(sql, settlement, tasksSince),
  };
}

function imageExecutionMaintenance(
  sql: postgres.Sql,
  settlement: ReturnType<typeof imageSettlement>,
  tasksSince?: Date,
) {
  const { refreshJob, refund, expireTimedOut, settleInvalidResponses } = settlement;
  return {
    async pruneEvents() {
      await sql`delete from generation_events where id in (select id from generation_events where created_at<now()-interval '7 days' order by created_at limit 1000)`;
    },
    async expireClaims() {
      await expireTimedOut();
      await settleInvalidResponses();
      // An expired paid attempt is held for operator reconciliation, never queued again.
      const rows =
        await sql`select id,job_id from generation_job_items where ${tasksSince ? sql`created_at>=${tasksSince} and` : sql``} status='running' and lease_expires_at<now() and not exists(select 1 from provider_executions e where e.item_id=generation_job_items.id and e.phase='polling' and e.task_id is not null and e.status_path is not null and e.next_poll_at is not null and (e.deadline_at>now() or exists(select 1 from provider_webhook_tasks w where w.item_id=e.item_id))) limit 100`;
      for (const row of rows)
        await sql.begin(async (tx) => {
          await tx`select id from generation_jobs where id=${row.job_id} for update`;
          await tx`update generation_job_items set status='needs_reconciliation',error_code='WORKER_OUTCOME_UNKNOWN',completed_at=now()
          where id=${row.id} and status='running' and lease_expires_at<now() and not exists(select 1 from provider_executions e where e.item_id=generation_job_items.id and e.phase='polling' and e.task_id is not null and e.status_path is not null and e.next_poll_at is not null and (e.deadline_at>now() or exists(select 1 from provider_webhook_tasks w where w.item_id=e.item_id)))`;
          await refreshJob(tx, String(row.job_id));
        });
    },
    async reconcile(scope: ImageScope, jobId: string, itemId: string, evidence: string) {
      return sql.begin(async (tx) => {
        const admins =
          await tx`select user_id from organization_members where organization_id=${scope.organizationId} and user_id=${scope.userId} and role='admin' for share`;
        if (!admins.length) throw new ImageRepositoryError("FORBIDDEN");
        const jobs =
          await tx`select id from generation_jobs where id=${jobId} and organization_id=${scope.organizationId} and not (input ? 'video') for update`;
        if (!jobs.length) throw new ImageRepositoryError("NOT_FOUND");
        const changed =
          await tx`update generation_job_items set status='failed',error_code='RECONCILED_FAILED',reconciled_by=${scope.userId},reconciliation_evidence=${evidence},completed_at=now()
          where id=${itemId} and job_id=${jobId} and status='needs_reconciliation' returning id`;
        if (!changed.length) throw new ImageRepositoryError("STATE_CONFLICT");
        await refund(tx, jobId, itemId);
        await refreshJob(tx, jobId);
      });
    },
  };
}
