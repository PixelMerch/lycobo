import { createHash, randomUUID } from "node:crypto";
import {
  type ImageGenerationInput,
  type ImageScope,
  type ImageTaskSubmission,
  imageGenerationInputSchema,
  imageProviderModel,
  imageUnitCredits,
  imageUserPrompt,
  providerModelForResolution,
  variationPlanInputSchema,
} from "@lycoboai/contracts";
import type postgres from "postgres";
import { resolveProviderSnapshot } from "../models/model-management-repository";
import { appendWalletEntry, ensureWallet } from "../wallet/wallet-repository";
import { recordImageEvent } from "./image-event-repository";
import { imageProviderRecovery, isVideoInput } from "./image-provider-recovery";
import { ImageRepositoryError, type IndependentModelConfiguration } from "./image-repository-types";
import type { imageSettlement } from "./image-settlement";

export type ImageCreditAuthorization = {
  provider: string;
  accountId: string;
  approvals: ReadonlyMap<number, string>;
};

type RetryItem = { id: string; position: number; status: string };
type SubmittedTaskRow = { id: string; publicId: string };

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
  acceptedUploadIds: readonly string[] = [],
) {
  const readyIds = input.referenceAssetIds.filter((id) => !acceptedUploadIds.includes(id));
  if (readyIds.length) {
    const refs =
      await tx`select id,width,height from media_assets where media_type='image' and organization_id=${scope.organizationId} and id in ${tx(readyIds)} and (expires_at is null or expires_at>now()) and storage_deleted_at is null and cleanup_started_at is null order by id for update`;
    if (refs.length !== readyIds.length) throw new ImageRepositoryError("REFERENCE_NOT_FOUND");
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
    // 新文本计划在提交时绑定素材数量，已有计划仍锁定原素材与顺序；素材归属已在上方校验。
    const referencesMatch =
      original.referenceCount !== undefined && !original.referenceAssetIds.length
        ? original.referenceCount === input.referenceAssetIds.length
        : JSON.stringify(original.referenceAssetIds) === JSON.stringify(input.referenceAssetIds);
    if (!referencesMatch) throw new ImageRepositoryError("REFERENCE_NOT_FOUND");
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
  walletId: string | undefined,
  credit?: ImageCreditAuthorization,
  previousItemId?: string,
) {
  const itemId = randomUUID();
  await tx`insert into generation_job_items (id,job_id,organization_id,position) values (${itemId},${jobId},${scope.organizationId},${position})`;
  if (credit) {
    const approval = credit.approvals.get(position);
    if (!approval) throw new ImageRepositoryError("STATE_CONFLICT");
    // 外部确认扣费之前只保存账务意图，生成消费者收不到此图片。
    await tx`insert into generation_credit_charges (item_id,user_id,provider,account_id,approval,amount,previous_item_id)
      values (${itemId},${scope.userId},${credit.provider},${credit.accountId},${approval},${imageUnitCredits},${previousItemId ?? null})`;
    return;
  }
  if (!walletId) throw new Error("WALLET_REQUIRED");
  await appendWalletEntry(tx, walletId, {
    eventKey: `consume:${itemId}`,
    kind: "consume",
    amount: -imageUnitCredits,
    userId: scope.userId,
    jobId,
    itemId,
  });
  await tx`insert into generation_outbox (item_id) values (${itemId})`;
}

async function acquireLocalWallet(
  tx: postgres.TransactionSql,
  scope: ImageScope,
  total: number,
  credit?: ImageCreditAuthorization,
) {
  if (credit) return undefined;
  const wallet = await ensureWallet(tx, scope);
  if (wallet.balance < total) throw new ImageRepositoryError("INSUFFICIENT_CREDITS");
  return wallet.id;
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

function assertApprovedRetryPositions(items: RetryItem[], approvedPositions?: readonly number[]) {
  // 审核在事务外完成；重试范围发生变化时，让用户重新提交这批图片。
  if (
    approvedPositions &&
    (approvedPositions.length !== items.length ||
      items.some((item) => !approvedPositions.includes(item.position)))
  )
    throw new ImageRepositoryError("STATE_CONFLICT");
}

async function retireFailedItems(
  tx: postgres.TransactionSql,
  scope: ImageScope,
  jobId: string,
  failed: RetryItem[],
  refund: ReturnType<typeof imageSettlement>["refund"],
) {
  // 主动重试保留原尝试的不确定结果与操作人，晚到结果不能覆盖新尝试。
  for (const item of failed) {
    if (item.status === "needs_reconciliation")
      await tx`update generation_job_items set status='failed',reconciled_by=${scope.userId},reconciliation_evidence='User requested retry; prior provider outcome remains unconfirmed; undelivered attempt retired',completed_at=coalesce(completed_at,now()) where id=${item.id}`;
    await refund(tx, jobId, String(item.id));
  }
}

async function findSubmissionReplay(
  sql: postgres.ISql,
  scope: ImageScope,
  key: string,
  inputHash: string,
) {
  const [replay] = await sql<
    (SubmittedTaskRow & { input_hash: string })[]
  >`select id,public_id as "publicId",input_hash from generation_jobs
    where organization_id=${scope.organizationId} and user_id=${scope.userId} and idempotency_key=${key}`;
  if (!replay) return undefined;
  if (replay.input_hash !== inputHash) throw new ImageRepositoryError("IDEMPOTENCY_CONFLICT");
  return { id: replay.id, publicId: replay.publicId, replayed: true };
}

async function insertSubmission(
  tx: postgres.TransactionSql,
  scope: ImageScope,
  input: ImageGenerationInput,
  details: { userPrompt: string; source: "mcp" | undefined },
  key: string,
  inputHash: string,
  requireManaged: boolean,
  independent: IndependentModelConfiguration | undefined,
) {
  const unitCredits = imageUnitCredits;
  const replay = await findSubmissionReplay(tx, scope, key, inputHash);
  if (replay) return replay;
  const snapshot = await submissionSnapshot(tx, input, requireManaged, independent);
  const inserted = await tx<
    SubmittedTaskRow[]
  >`insert into generation_jobs (organization_id,user_id,idempotency_key,input_hash,input,model,provider_model,prompt,user_prompt,submission_source,resolution,aspect_ratio,requested_count,unit_credits,provider_snapshot)
          values (${scope.organizationId},${scope.userId},${key},${inputHash},${tx.json(input)},${input.model},${snapshot ? providerModelForResolution(snapshot, input.resolution) : imageProviderModel(input)},${input.prompt},${details.userPrompt},${details.source ?? null},${input.resolution},${input.aspectRatio},${input.count},${unitCredits},${snapshot ? tx.json(snapshot) : null})
          on conflict (organization_id,user_id,idempotency_key) do nothing returning id,public_id as "publicId"`;
  if (!inserted[0]) {
    const existing = await findSubmissionReplay(tx, scope, key, inputHash);
    if (existing) return existing;
    throw new ImageRepositoryError("IDEMPOTENCY_CONFLICT");
  }
  return { ...inserted[0], replayed: false };
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
  tx: postgres.ISql,
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
  // 全部确定失败后允许刷新渠道，部分失败或结果未知沿用原快照。
  const allDefinitivelyFailed = items.every((item) => item.status === "failed");
  if (job.provider_snapshot && !allDefinitivelyFailed) return;
  if (items.some((item) => item.status === "queued" || item.status === "running"))
    throw new ImageRepositoryError("STATE_CONFLICT");
  await refreshRetryRouting(tx, jobId, job, independent);
}

/** 原子保存任务、计费与 outbox，已接收上传可由后台完成后继续生成。 */
export function imageSubmissionRepository(
  sql: postgres.Sql,
  settlement: ReturnType<typeof imageSettlement>,
  independent?: IndependentModelConfiguration,
) {
  const { refreshJob, refund } = settlement;
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  return {
    async replayImageSubmission(scope: ImageScope, submitted: ImageTaskSubmission, key: string) {
      return findSubmissionReplay(sql, scope, key, hash(JSON.stringify(submitted)));
    },
    async replayImageRetry(scope: ImageScope, jobId: string, key: string, itemId?: string) {
      return isRetryReplay(sql, scope, jobId, key, itemId);
    },
    async create(
      scope: ImageScope,
      submitted: ImageTaskSubmission & { submissionSource?: "mcp" },
      key: string,
      _legacyUnitCredits?: number,
      requireManaged = false,
      acceptedUploadIds: readonly string[] = [],
      credit?: ImageCreditAuthorization,
    ) {
      const unitCredits = imageUnitCredits;
      // 提交来源只作素材筛选。保留首次接收时的来源，旧请求重试仍使用原幂等哈希。
      const { submissionSource, ...request } = submitted;
      const { userPrompt, ...input } = request;
      const inputHash = hash(JSON.stringify(request));
      return sql.begin(async (tx) => {
        await verifyMember(tx, scope);
        const submission = await insertSubmission(
          tx,
          scope,
          input,
          {
            userPrompt: userPrompt ?? imageUserPrompt(input.prompt, input),
            source: submissionSource,
          },
          key,
          inputHash,
          requireManaged,
          independent,
        );
        if (submission.replayed) return submission;
        const { id } = submission;
        await verifySubmissionReferences(tx, scope, id, input, acceptedUploadIds);
        const total = unitCredits * input.count;
        const walletId = await acquireLocalWallet(tx, scope, total, credit);
        if (walletId)
          await tx`insert into generation_credit_ledger (organization_id,job_id,event_type,amount) values (${scope.organizationId},${id},'reserve',${-total})`;
        for (let position = 0; position < input.count; position++) {
          await enqueueImageItem(tx, scope, id, position, walletId, credit);
        }
        if (input.referenceAssetIds.length)
          await tx`update media_assets set expires_at=null where organization_id=${scope.organizationId} and id in ${tx(input.referenceAssetIds)}`;
        await recordImageEvent(tx, scope.organizationId, "task", id);
        return submission;
      });
    },
    ...imageProviderRecovery(sql, settlement.refreshJob),
    async retry(
      scope: ImageScope,
      jobId: string,
      key: string,
      itemId?: string,
      requireManaged = false,
      approvedPositions?: readonly number[],
      credit?: ImageCreditAuthorization,
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
        assertApprovedRetryPositions(failed, approvedPositions);
        if (requireManaged) await refreshManagedRetry(tx, jobId, job, items, independent);
        await retireFailedItems(tx, scope, jobId, failed, refund);
        const walletId = await acquireLocalWallet(
          tx,
          scope,
          imageUnitCredits * failed.length,
          credit,
        );
        await tx`insert into generation_retries (organization_id,user_id,job_id,idempotency_key,target_item_id) values (${scope.organizationId},${scope.userId},${jobId},${key},${itemId ?? null})`;
        for (const item of failed) {
          await tx`update generation_job_items set superseded_at=now() where id=${item.id}`;
          await enqueueImageItem(tx, scope, jobId, item.position, walletId, credit, item.id);
        }
        await refreshJob(tx, jobId);
        return { id: jobId, replayed: false };
      });
    },
  };
}
