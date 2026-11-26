import {
  type ImageScope,
  imageGenerationInputSchema,
  providerSnapshotSchema,
} from "@lycoboai/contracts";
import type postgres from "postgres";
import { ImageRepositoryError } from "./image-repository-types";
import type { imageSettlement } from "./image-settlement";

/** 识别共用任务表中的视频输入，避免图片接口接管。 */
export function isVideoInput(input: unknown) {
  return typeof input === "object" && input !== null && "video" in input;
}

/** 在扣费仍有效时把原模型任务放回队列，沿用已有回执和结果。 */
export function imageProviderRecovery(
  sql: postgres.Sql,
  refreshJob: ReturnType<typeof imageSettlement>["refreshJob"],
) {
  return {
    async providerRetryCandidates(scope: ImageScope, jobId: string, itemId?: string) {
      const rows =
        await sql`select i.id,e.task_id,e.status_path,j.provider_snapshot,j.input from generation_jobs j
        join generation_job_items i on i.job_id=j.id join provider_executions e on e.item_id=i.id
        where j.id=${jobId} and j.organization_id=${scope.organizationId} and i.superseded_at is null
        and i.status in ('failed','needs_reconciliation')
        and not exists(select 1 from generation_credit_charges c where c.item_id=i.id and c.state<>'paid') and e.task_id is not null and e.status_path is not null
        and exists(select 1 from organization_members where organization_id=j.organization_id and user_id=${scope.userId})
        ${itemId ? sql`and i.id=${itemId}` : sql``}`;
      return rows.map((row) => ({
        itemId: String(row.id),
        taskId: String(row.task_id),
        statusPath: String(row.status_path),
        snapshot: providerSnapshotSchema.parse(row.provider_snapshot),
        input: imageGenerationInputSchema.parse(row.input),
      }));
    },
    async resumeProvider(scope: ImageScope, jobId: string, itemId: string) {
      return sql.begin(async (tx) => {
        const [job] =
          await tx`select id,input from generation_jobs where id=${jobId} and organization_id=${scope.organizationId}
          and exists(select 1 from organization_members where organization_id=${scope.organizationId} and user_id=${scope.userId}) for update`;
        if (!job || isVideoInput(job.input)) throw new ImageRepositoryError("NOT_FOUND");
        // 核对结果与新任务共用账号名额，实际领取时才开始计算恢复期限。
        const changed =
          await tx`update generation_job_items set status='queued',error_code=null,completed_at=null,
          execution_token=gen_random_uuid(),lease_expires_at=null,started_at=null,reconciled_by=${scope.userId},
          reconciliation_evidence='User retry verified the original provider task; resume result retrieval without new generation or charge'
          where id=${itemId} and job_id=${jobId} and superseded_at is null and status in ('failed','needs_reconciliation')
          and not exists(select 1 from generation_credit_charges c where c.item_id=${itemId} and c.state<>'paid') returning id`;
        if (!changed.length) return;
        // 旧消费者仍使用恢复时写入的期限，新消费者改为从真正领取起算。
        await tx`update provider_executions set phase='polling',deadline_at=now()+interval '3 minutes',next_poll_at=now(),lease_until=null,poll_failures=0 where item_id=${itemId}`;
        await tx`update generation_outbox set dispatched_at=null,next_attempt_at=now(),lease_token=null,lease_expires_at=null where item_id=${itemId}`;
        await refreshJob(tx, jobId);
      });
    },
  };
}
