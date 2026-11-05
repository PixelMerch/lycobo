import { createHash, randomUUID } from "node:crypto";
import {
  type ImageGenerationInput,
  type ImageScope,
  imageGenerationInputSchema,
  imageProviderModel,
  imageUnitCredits,
  providerModelForResolution,
  providerSnapshotSchema,
  variationPlanInputSchema,
} from "@lycoboai/contracts";
import type postgres from "postgres";
import { recordImageEvent } from "./image-event-repository";
import { ImageRepositoryError, type IndependentModelConfiguration } from "./image-repository-types";
import type { imageSettlement } from "./image-settlement";
import { resolveProviderSnapshot } from "./model-management-repository";
import { appendWalletEntry, ensureWallet } from "./wallet-repository";

type RetryItem = { id: string; position: number; status: string };

function isVideoInput(input: unknown) {
  return typeof input === "object" && input !== null && "video" in input;
}

async function verifyMember(tx: postgres.TransactionSql, scope: ImageScope) {
  const members =
    await tx`select user_id from organization_members where organization_id=${scope.organizationId} and user_id=${scope.userId} for share`;
  if (!members.length) throw new ImageRepositoryError("FORBIDDEN");
}

async function verifySubmissionReferences(
  tx: postgres.TransactionSql,
  scope: ImageScope,
  id: string,
  input: ImageGenerationInput,
) {
  if (input.referenceAssetIds.length) {
    const refs =
      await tx`select id,width,height from media_assets where media_type='image' and organization_id=${scope.organizationId} and id in ${tx(input.referenceAssetIds)} and (expires_at is null or expires_at>now()) and storage_deleted_at is null and cleanup_started_at is null order by id for update`;
    if (refs.length !== input.referenceAssetIds.length)
      throw new ImageRepositoryError("REFERENCE_NOT_FOUND");
  }
  if (input.localEdit) {
    const edit = input.localEdit;
    const [source] =
      await tx`select width,height from media_assets where id=${edit.sourceAssetId} and organization_id=${scope.organizationId}`;
    if (!source || Number(source.width) !== edit.width || Number(source.height) !== edit.height)
      throw new ImageRepositoryError("REFERENCE_NOT_FOUND");
    await tx`insert into image_local_edits (job_id,organization_id,user_id,source_asset_id)
            values (${id},${scope.organizationId},${scope.userId},${edit.sourceAssetId})`;
  }
  if (input.variation) {
    const [plan] =
      await tx`select input,status from variation_plans where id=${input.variation.planId} and organization_id=${scope.organizationId} and user_id=${scope.userId}`;
    if (plan?.status !== "ready") throw new ImageRepositoryError("STATE_CONFLICT");
    const original = variationPlanInputSchema.parse(plan.input);
    if (JSON.stringify(original.referenceAssetIds) !== JSON.stringify(input.referenceAssetIds))
      throw new ImageRepositoryError("REFERENCE_NOT_FOUND");
  }
}

async function submissionSnapshot(
  tx: postgres.TransactionSql,
  input: ImageGenerationInput,
  requireManaged: boolean,
  independent: IndependentModelConfiguration | undefined,
) {
  return (
    independent
      ? Promise.resolve().then(() => independent.resolve(input))
      : resolveProviderSnapshot(tx, input, requireManaged)
  ).catch((error: unknown) => {
    if (
      error instanceof Error &&
      ["MODEL_CHANNEL_DISABLED", "MODEL_CHANNEL_CAPABILITY"].includes(error.message)
    )
      throw new ImageRepositoryError("MODEL_CAPABILITY_UNVERIFIED");
    throw error;
  });
}

async function enqueueImageItem(
  tx: postgres.TransactionSql,
  scope: ImageScope,
  jobId: string,
  position: number,
  walletId: string,
  unitCredits: number,
) {
  const itemId = randomUUID();
  await tx`insert into generation_job_items (id,job_id,organization_id,position) values (${itemId},${jobId},${scope.organizationId},${position})`;
  await appendWalletEntry(tx, walletId, {
    eventKey: `consume:${itemId}`,
    kind: "consume",
    amount: -unitCredits,
    userId: scope.userId,
    jobId,
    itemId,
  });
  await tx`insert into generation_outbox (item_id) values (${itemId})`;
}

async function refreshRetryRouting(
  tx: postgres.TransactionSql,
  jobId: string,
  job: { input: unknown; provider_snapshot?: unknown },
  independent: IndependentModelConfiguration | undefined,
) {
  const input = imageGenerationInputSchema.parse(job.input);
  const snapshot = await (independent
    ? Promise.resolve().then(() => independent.resolve(input))
    : resolveProviderSnapshot(tx, input, true)
  ).catch(() => {
    throw new ImageRepositoryError("MODEL_CAPABILITY_UNVERIFIED");
  });
  if (!snapshot) throw new ImageRepositoryError("MODEL_CAPABILITY_UNVERIFIED");
  if (job.provider_snapshot) {
    const evidence = `Explicit retry adopted current routing; prior provider snapshot: ${JSON.stringify(job.provider_snapshot)}`;
    await tx`update generation_job_items set reconciliation_evidence=concat_ws('; ',reconciliation_evidence,${evidence}::text) where job_id=${jobId} and superseded_at is null`;
  }
  await tx`update generation_jobs set provider_snapshot=${tx.json(snapshot)},provider_model=${providerModelForResolution(snapshot, input.resolution)} where id=${jobId}`;
}

function retryableItems(items: RetryItem[], itemId: string | undefined) {
  if (!itemId && items.some((i) => i.status === "queued" || i.status === "running"))
    throw new ImageRepositoryError("STATE_CONFLICT");
  const failed = items.filter(
    (i) =>
      (!itemId || i.id === itemId) &&
      (i.status === "failed" || i.status === "needs_reconciliation"),
  );
  if (!failed.length) throw new ImageRepositoryError("STATE_CONFLICT");
  return failed;
}

async function retireFailedItems(
  tx: postgres.TransactionSql,
  scope: ImageScope,
  jobId: string,
  failed: RetryItem[],
  refund: ReturnType<typeof imageSettlement>["refund"],
) {
  // Explicit user retry retires unresolved attempts before refund/recharge.
  // Keep the uncertain provider outcome as evidence; do not call this
  // reconciliation proof or let a late completion replace the new attempt.
  for (const item of failed) {
    if (item.status === "needs_reconciliation")
      await tx`update generation_job_items set status='failed',reconciled_by=${scope.userId},reconciliation_evidence='User requested retry; prior provider outcome remains unconfirmed; undelivered attempt retired',completed_at=coalesce(completed_at,now()) where id=${item.id}`;
    await refund(tx, jobId, String(item.id));
  }
}

async function insertSubmission(
  tx: postgres.TransactionSql,
  scope: ImageScope,
  input: ImageGenerationInput,
  key: string,
  inputHash: string,
  requireManaged: boolean,
  independent: IndependentModelConfiguration | undefined,
) {
  const unitCredits = imageUnitCredits;
  const [replay] =
    await tx`select id,input_hash from generation_jobs where organization_id=${scope.organizationId} and user_id=${scope.userId} and idempotency_key=${key}`;
  if (replay) {
    if (replay.input_hash !== inputHash) throw new ImageRepositoryError("IDEMPOTENCY_CONFLICT");
    return { id: String(replay.id), replayed: true };
  }
  const snapshot = await submissionSnapshot(tx, input, requireManaged, independent);
  const inserted =
    await tx`insert into generation_jobs (organization_id,user_id,idempotency_key,input_hash,input,model,provider_model,prompt,resolution,aspect_ratio,requested_count,unit_credits,provider_snapshot)
          values (${scope.organizationId},${scope.userId},${key},${inputHash},${tx.json(input)},${input.model},${snapshot ? providerModelForResolution(snapshot, input.resolution) : imageProviderModel(input)},${input.prompt},${input.resolution},${input.aspectRatio},${input.count},${unitCredits},${snapshot ? tx.json(snapshot) : null})
          on conflict (organization_id,user_id,idempotency_key) do nothing returning id`;
  if (!inserted[0]) {
    const [existing] =
      await tx`select id,input_hash from generation_jobs where organization_id=${scope.organizationId} and user_id=${scope.userId} and idempotency_key=${key}`;
    if (!existing || existing.input_hash !== inputHash)
      throw new ImageRepositoryError("IDEMPOTENCY_CONFLICT");
    return { id: String(existing.id), replayed: true };
  }
  return { id: String(inserted[0].id), replayed: false };
}

function imageProviderRecovery(
  sql: postgres.Sql,
  refreshJob: ReturnType<typeof imageSettlement>["refreshJob"],
) {
  return {
    async providerRetryCandidates(scope: ImageScope, jobId: string, itemId?: string) {
      const rows =
        await sql`select i.id,e.task_id,e.status_path,j.provider_snapshot,j.input from generation_jobs j
        join generation_job_items i on i.job_id=j.id join provider_executions e on e.item_id=i.id
        where j.id=${jobId} and j.organization_id=${scope.organizationId} and i.superseded_at is null
        and i.status in ('failed','needs_reconciliation') and e.task_id is not null and e.status_path is not null
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
        const changed =
          await tx`update generation_job_items set status='running',error_code=null,completed_at=null,
          execution_token=gen_random_uuid(),lease_expires_at=null,started_at=now(),reconciled_by=${scope.userId},
          reconciliation_evidence='User retry verified the original provider task; resume result retrieval without new generation or charge'
          where id=${itemId} and job_id=${jobId} and superseded_at is null and status in ('failed','needs_reconciliation') returning id`;
        if (!changed.length) return;
        await tx`update provider_executions set phase='polling',deadline_at=now()+interval '3 minutes',next_poll_at=now(),lease_until=null,poll_failures=0 where item_id=${itemId}`;
        await tx`update generation_outbox set next_attempt_at=now(),lease_token=null,lease_expires_at=null where item_id=${itemId}`;
        await refreshJob(tx, jobId);
      });
    },
  };
}

type RetryJob = { input: unknown; provider_snapshot: unknown };

async function loadRetryJob(tx: postgres.TransactionSql, scope: ImageScope, jobId: string) {
  const [job] = await tx<
    RetryJob[]
  >`select id,status,unit_credits,input,provider_snapshot from generation_jobs where id=${jobId} and organization_id=${scope.organizationId} for update`;
  if (!job || isVideoInput(job.input)) throw new ImageRepositoryError("NOT_FOUND");
  return job;
}

async function isRetryReplay(
  tx: postgres.TransactionSql,
  scope: ImageScope,
  jobId: string,
  key: string,
  itemId: string | undefined,
) {
  const [previous] =
    await tx`select job_id,target_item_id from generation_retries where organization_id=${scope.organizationId} and user_id=${scope.userId} and idempotency_key=${key}`;
  if (previous) {
    if (previous.job_id !== jobId || (previous.target_item_id ?? undefined) !== itemId)
      throw new ImageRepositoryError("IDEMPOTENCY_CONFLICT");
    return true;
  }
  return false;
}

async function refreshManagedRetry(
  tx: postgres.TransactionSql,
  jobId: string,
  job: RetryJob,
  items: RetryItem[],
  independent: IndependentModelConfiguration | undefined,
) {
  // Explicit retries of fully, definitively failed jobs may adopt corrected routing.
  // Partial/uncertain/in-flight jobs keep their accepted snapshot for reconciliation.
  const allDefinitivelyFailed = items.every((item) => item.status === "failed");
  if (job.provider_snapshot && !allDefinitivelyFailed) return;
  if (items.some((item) => item.status === "queued" || item.status === "running"))
    throw new ImageRepositoryError("STATE_CONFLICT");
  await refreshRetryRouting(tx, jobId, job, independent);
}

export function imageSubmissionRepository(
  sql: postgres.Sql,
  settlement: ReturnType<typeof imageSettlement>,
  independent?: IndependentModelConfiguration,
) {
  const { refreshJob, refund } = settlement;
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  return {
    async create(
      scope: ImageScope,
      input: ImageGenerationInput,
      key: string,
      _legacyUnitCredits?: number,
      requireManaged = false,
    ) {
      const unitCredits = imageUnitCredits;
      const inputHash = hash(JSON.stringify(input));
      return sql.begin(async (tx) => {
        await verifyMember(tx, scope);
        const submission = await insertSubmission(
          tx,
          scope,
          input,
          key,
          inputHash,
          requireManaged,
          independent,
        );
        if (submission.replayed) return submission;
        const { id } = submission;
        await verifySubmissionReferences(tx, scope, id, input);
        const total = unitCredits * input.count;
        const wallet = await ensureWallet(tx, scope);
        if (wallet.balance < total) throw new ImageRepositoryError("INSUFFICIENT_CREDITS");
        await tx`insert into generation_credit_ledger (organization_id,job_id,event_type,amount) values (${scope.organizationId},${id},'reserve',${-total})`;
        for (let position = 0; position < input.count; position++) {
          await enqueueImageItem(tx, scope, id, position, wallet.id, unitCredits);
        }
        if (input.referenceAssetIds.length)
          await tx`update media_assets set expires_at=null where organization_id=${scope.organizationId} and id in ${tx(input.referenceAssetIds)}`;
        await recordImageEvent(tx, scope.organizationId, "task", id);
        return { id, replayed: false };
      });
    },
    ...imageProviderRecovery(sql, settlement.refreshJob),
    async retry(
      scope: ImageScope,
      jobId: string,
      key: string,
      itemId?: string,
      requireManaged = false,
    ) {
      return sql.begin(async (tx) => {
        await verifyMember(tx, scope);
        const job = await loadRetryJob(tx, scope, jobId);
        if (await isRetryReplay(tx, scope, jobId, key, itemId))
          return { id: jobId, replayed: true };
        const items = await tx<
          RetryItem[]
        >`select id,position,status,error_code from generation_job_items where job_id=${jobId} and superseded_at is null order by position for update`;
        const failed = retryableItems(items, itemId);
        if (requireManaged) await refreshManagedRetry(tx, jobId, job, items, independent);
        await retireFailedItems(tx, scope, jobId, failed, refund);
        const wallet = await ensureWallet(tx, scope);
        if (wallet.balance < imageUnitCredits * failed.length)
          throw new ImageRepositoryError("INSUFFICIENT_CREDITS");
        await tx`insert into generation_retries (organization_id,user_id,job_id,idempotency_key,target_item_id) values (${scope.organizationId},${scope.userId},${jobId},${key},${itemId ?? null})`;
        for (const item of failed) {
          await tx`update generation_job_items set superseded_at=now() where id=${item.id}`;
          await enqueueImageItem(tx, scope, jobId, item.position, wallet.id, imageUnitCredits);
        }
        await refreshJob(tx, jobId);
        return { id: jobId, replayed: false };
      });
    },
  };
}
