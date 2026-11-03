import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  type AssetType,
  assetFavoriteLimit,
  type ImageGenerationInput,
  type ImageScope,
  type ImageTool,
  imageGenerationInputSchema,
  imageProviderModel,
  imageUnitCredits,
  type ProviderSnapshot,
  providerModelForResolution,
  providerSnapshotSchema,
  type StoredImage,
  variationPlanInputSchema,
} from "@lycoboai/contracts";
import postgres from "postgres";
import { recordImageEvent } from "./image-event-repository";
import { modelManagementRepository, resolveProviderSnapshot } from "./model-management-repository";
import { nativeProviderWebhooks } from "./provider-webhook-repository";
import { variationRepository } from "./variation-repository";
import { appendWalletEntry, ensureWallet, walletRepository } from "./wallet-repository";

export class ImageRepositoryError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
export type ImagePrincipal = ImageScope & { role: "admin" | "member"; uid?: string };
/** Asset library filters applied before pagination; favorites belong to the signed-in member. */
export type AssetFilters = {
  tool?: ImageTool | undefined;
  model?: string | undefined;
  favorite?: boolean | undefined;
};
export type ClaimedImage = {
  itemId: string;
  position: number;
  jobId: string;
  organizationId: string;
  userId: string;
  executionToken: string;
  input: ImageGenerationInput;
  providerModel: ImageGenerationInput["model"];
  configuredProvider?:
    | {
        snapshot: ProviderSnapshot;
        phase: string;
        taskId: string | null;
        statusPath: string | null;
        deadlineAt: Date;
        pollFailures: number;
      }
    | undefined;
};
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export interface IndependentModelConfiguration {
  credentialId: string;
  credentialCipher: string;
  planner: NonNullable<Awaited<ReturnType<ReturnType<typeof variationRepository>["config"]>>>;
  capabilities: ReturnType<typeof modelManagementRepository>["capabilities"] extends () => Promise<
    infer T
  >
    ? () => T
    : never;
  resolve: (input: ImageGenerationInput) => ProviderSnapshot;
}
export function openImageRepository(
  url: string,
  edge = false,
  independent?: IndependentModelConfiguration,
) {
  const sql = postgres(url, {
    max: edge ? 1 : 5,
    fetch_types: !edge,
    prepare: true,
    idle_timeout: 20,
    connect_timeout: 10,
    connection: { statement_timeout: 15000, lock_timeout: 5000 },
  });
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
      await sql`select id,job_id from generation_job_items where status='needs_reconciliation' and error_code='PROVIDER_INVALID_IMAGE_RESPONSE' and superseded_at is null limit 100`;
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
  const publicModelSql = sql`case when j.model in ('nano-banana-2.1','gemini-nano-banana-2.1') then 'nano-banana-2.1'
    when j.model in ('gpt-image-2.5','gpt-image-2.5-flare','gpt-image-2.5-sunburst') then 'gpt-image-2.5'
    when j.model in ('gpt-image-2','gpt-image-2-4K') then 'gpt-image-2' else j.model end`;
  // A task's tool is recorded by its input: textile and variation inputs carry their own keys.
  const toolMatchSql = (tool: ImageTool) =>
    tool === "textile"
      ? sql`j.input ? 'textileSet'`
      : tool === "variation"
        ? sql`j.input ? 'variation'`
        : sql`not (j.input ? 'textileSet') and not (j.input ? 'variation')`;
  const toolSql = sql`case when j.id is null then null when j.input ? 'textileSet' then 'textile'
    when j.input ? 'variation' then 'variation' else 'create' end`;
  const visibleAssetSql = sql`(a.expires_at is null or a.expires_at>now()) and a.storage_deleted_at is null`;
  const jobView = sql`j.public_id,j.id,j.organization_id,j.user_id,${publicModelSql} as model,j.prompt,j.resolution,j.aspect_ratio,
    j.requested_count,j.unit_credits,j.status,j.input,j.created_at,j.updated_at,j.completed_at,
    (select coalesce(json_agg(json_build_object('id',i.id,'position',i.position,'status',i.status,
      'worker_id',i.worker_id,'provider',i.provider,'provider_request_id',i.provider_request_id,
      'attempts',i.attempts,'error_code',i.error_code,'started_at',i.started_at,'completed_at',i.completed_at,
      'output_asset_id',i.output_asset_id,'output_public_id',a.public_id,'width',a.width,'height',a.height,'bytes',a.bytes) order by i.position),'[]')
      from generation_job_items i left join media_assets a on a.id=i.output_asset_id and a.organization_id=i.organization_id where i.job_id=j.id and i.superseded_at is null) as items`;
  const expireTimedOut = async (organizationId?: string) => {
    const rows = await sql`select i.id,i.job_id from generation_job_items i
      where i.status='running' and i.superseded_at is null and i.started_at<now()-interval '3 minutes' and not exists(select 1 from provider_webhook_tasks w join provider_executions e on e.item_id=w.item_id where w.item_id=i.id and e.phase='polling')
      ${organizationId ? sql`and i.organization_id=${organizationId}` : sql``} limit 100`;
    for (const row of rows)
      await sql.begin(async (tx) => {
        await tx`select id from generation_jobs where id=${row.job_id} for update`;
        const changed =
          await tx`update generation_job_items set status='needs_reconciliation',error_code='PROVIDER_TIMEOUT',completed_at=now()
        where id=${row.id} and status='running' and superseded_at is null and started_at<now()-interval '3 minutes' and not exists(select 1 from provider_webhook_tasks w join provider_executions e on e.item_id=w.item_id where w.item_id=generation_job_items.id and e.phase='polling') returning id`;
        if (changed.length) await refreshJob(tx, String(row.job_id));
      });
  };
  return {
    ...nativeProviderWebhooks(sql),
    async storageUid(scope: ImageScope) {
      const [row] =
        await sql`select u.uid from users u join organization_members m on m.user_id=u.id
        where u.id=${scope.userId} and m.organization_id=${scope.organizationId}`;
      if (!row || !/^[0-9]{10}$/.test(String(row.uid))) throw new ImageRepositoryError("FORBIDDEN");
      return String(row.uid);
    },
    variation: {
      ...variationRepository(sql),
      ...(independent ? { config: async () => independent.planner } : {}),
    },
    close: () => sql.end({ timeout: 5 }),
    settleInvalidResponses,
    ...walletRepository(sql),
    async provision(
      subject: string,
      organizationName: string,
      credits: number,
      reuseOrganization = false,
    ) {
      const token = randomBytes(32).toString("base64url");
      return sql.begin(async (tx) => {
        const [user] =
          await tx`insert into users (auth_subject) values (${subject}) on conflict (auth_subject)
          do update set auth_subject=excluded.auth_subject returning id,uid`;
        if (!user) throw new Error("PROVISION_FAILED");
        let org = reuseOrganization
          ? (
              await tx`select o.id from organizations o join organization_members m on m.organization_id=o.id
              where m.user_id=${user.id} and m.role='admin' and o.name=${organizationName} order by o.created_at limit 1`
            )[0]
          : undefined;
        if (!org) {
          [org] =
            await tx`insert into organizations (name,available_credits) values (${organizationName},0) returning id`;
          if (!org) throw new Error("PROVISION_FAILED");
          await tx`insert into organization_members (organization_id,user_id,role) values (${org.id},${user.id},'admin')`;
          const wallet = await ensureWallet(tx, {
            organizationId: String(org.id),
            userId: String(user.id),
          });
          if (credits > 0)
            await appendWalletEntry(tx, wallet.id, {
              eventKey: "provision-opening",
              kind: "opening",
              amount: credits,
              userId: String(user.id),
            });
        }
        const [key] =
          await tx`insert into generation_api_keys (organization_id,user_id,token_hash,expires_at)
          values (${org.id},${user.id},${hash(token)},now()+interval '7 days') returning id`;
        return {
          userId: String(user.id),
          uid: String(user.uid),
          organizationId: String(org.id),
          keyId: String(key?.id),
          token,
        };
      });
    },
    models: {
      ...modelManagementRepository(sql),
      ...(independent
        ? {
            logos: async () => ({
              models:
                independent
                  .capabilities()
                  .create?.map((model) => ({ id: model.id, logoUrl: null })) ?? [],
            }),
            hasRoute: async (input: ImageGenerationInput) => {
              independent.resolve(input);
              return true;
            },
            capabilities: async () => independent.capabilities(),
          }
        : {}),
    },
    async authenticate(token: string): Promise<ImagePrincipal | null> {
      if (!/^[\w-]{43}$/.test(token)) return null;
      const [row] =
        await sql`select k.user_id,k.organization_id,m.role,u.uid from generation_api_keys k
        join users u on u.id=k.user_id
        join organization_members m on m.organization_id=k.organization_id and m.user_id=k.user_id
        where k.token_hash=${hash(token)} and k.revoked_at is null and k.expires_at>now()`;
      if (!row || (row.role !== "admin" && row.role !== "member")) return null;
      return {
        userId: String(row.user_id),
        organizationId: String(row.organization_id),
        role: row.role,
        uid: String(row.uid),
      };
    },
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
        const members =
          await tx`select user_id from organization_members where organization_id=${scope.organizationId} and user_id=${scope.userId} for share`;
        if (!members.length) throw new ImageRepositoryError("FORBIDDEN");
        const [replay] =
          await tx`select id,input_hash from generation_jobs where organization_id=${scope.organizationId} and user_id=${scope.userId} and idempotency_key=${key}`;
        if (replay) {
          if (replay.input_hash !== inputHash)
            throw new ImageRepositoryError("IDEMPOTENCY_CONFLICT");
          return { id: String(replay.id), replayed: true };
        }
        const snapshot = await (independent
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
        const id = String(inserted[0].id);
        if (input.referenceAssetIds.length) {
          const refs =
            await tx`select id,width,height from media_assets where organization_id=${scope.organizationId} and id in ${tx(input.referenceAssetIds)} and (expires_at is null or expires_at>now()) and storage_deleted_at is null and cleanup_started_at is null order by id for update`;
          if (refs.length !== input.referenceAssetIds.length)
            throw new ImageRepositoryError("REFERENCE_NOT_FOUND");
        }
        if (input.localEdit) {
          const edit = input.localEdit;
          const [source] =
            await tx`select width,height from media_assets where id=${edit.sourceAssetId} and organization_id=${scope.organizationId}`;
          if (
            !source ||
            Number(source.width) !== edit.width ||
            Number(source.height) !== edit.height
          )
            throw new ImageRepositoryError("REFERENCE_NOT_FOUND");
          await tx`insert into image_local_edits (job_id,organization_id,user_id,source_asset_id)
            values (${id},${scope.organizationId},${scope.userId},${edit.sourceAssetId})`;
        }
        if (input.variation) {
          const [plan] =
            await tx`select input,status from variation_plans where id=${input.variation.planId} and organization_id=${scope.organizationId} and user_id=${scope.userId}`;
          if (!plan || plan.status !== "ready") throw new ImageRepositoryError("STATE_CONFLICT");
          const original = variationPlanInputSchema.parse(plan.input);
          if (
            JSON.stringify(original.referenceAssetIds) !== JSON.stringify(input.referenceAssetIds)
          )
            throw new ImageRepositoryError("REFERENCE_NOT_FOUND");
        }
        const total = unitCredits * input.count;
        const wallet = await ensureWallet(tx, scope);
        if (wallet.balance < total) throw new ImageRepositoryError("INSUFFICIENT_CREDITS");
        await tx`insert into generation_credit_ledger (organization_id,job_id,event_type,amount) values (${scope.organizationId},${id},'reserve',${-total})`;
        for (let position = 0; position < input.count; position++) {
          const itemId = randomUUID();
          await tx`insert into generation_job_items (id,job_id,organization_id,position) values (${itemId},${id},${scope.organizationId},${position})`;
          await appendWalletEntry(tx, wallet.id, {
            eventKey: `consume:${itemId}`,
            kind: "consume",
            amount: -unitCredits,
            userId: scope.userId,
            jobId: id,
            itemId,
          });
          await tx`insert into generation_outbox (item_id) values (${itemId})`;
        }
        if (input.referenceAssetIds.length)
          await tx`update media_assets set expires_at=null where organization_id=${scope.organizationId} and id in ${tx(input.referenceAssetIds)}`;
        await recordImageEvent(tx, scope.organizationId, "task", id);
        return { id, replayed: false };
      });
    },
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
          await tx`select id from generation_jobs where id=${jobId} and organization_id=${scope.organizationId}
          and exists(select 1 from organization_members where organization_id=${scope.organizationId} and user_id=${scope.userId}) for update`;
        if (!job) throw new ImageRepositoryError("NOT_FOUND");
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
    async retry(
      scope: ImageScope,
      jobId: string,
      key: string,
      itemId?: string,
      requireManaged = false,
    ) {
      return sql.begin(async (tx) => {
        const members =
          await tx`select user_id from organization_members where organization_id=${scope.organizationId} and user_id=${scope.userId} for share`;
        if (!members.length) throw new ImageRepositoryError("FORBIDDEN");
        const [job] =
          await tx`select id,status,unit_credits,input,provider_snapshot from generation_jobs where id=${jobId} and organization_id=${scope.organizationId} for update`;
        if (!job) throw new ImageRepositoryError("NOT_FOUND");
        const [previous] =
          await tx`select job_id,target_item_id from generation_retries where organization_id=${scope.organizationId} and user_id=${scope.userId} and idempotency_key=${key}`;
        if (previous) {
          if (previous.job_id !== jobId || (previous.target_item_id ?? undefined) !== itemId)
            throw new ImageRepositoryError("IDEMPOTENCY_CONFLICT");
          return { id: jobId, replayed: true };
        }
        const items =
          await tx`select id,position,status,error_code from generation_job_items where job_id=${jobId} and superseded_at is null order by position for update`;
        if (!itemId && items.some((i) => i.status === "queued" || i.status === "running"))
          throw new ImageRepositoryError("STATE_CONFLICT");
        const failed = items.filter(
          (i) =>
            (!itemId || i.id === itemId) &&
            (i.status === "failed" || i.status === "needs_reconciliation"),
        );
        if (!failed.length) throw new ImageRepositoryError("STATE_CONFLICT");
        // Explicit retries of fully, definitively failed jobs may adopt corrected routing.
        // Partial/uncertain/in-flight jobs keep their accepted snapshot for reconciliation.
        const allDefinitivelyFailed = items.every((item) => item.status === "failed");
        if (requireManaged && (!job.provider_snapshot || allDefinitivelyFailed)) {
          if (items.some((item) => item.status === "queued" || item.status === "running"))
            throw new ImageRepositoryError("STATE_CONFLICT");
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
        // Explicit user retry retires unresolved attempts before refund/recharge.
        // Keep the uncertain provider outcome as evidence; do not call this
        // reconciliation proof or let a late completion replace the new attempt.
        for (const item of failed) {
          if (item.status === "needs_reconciliation")
            await tx`update generation_job_items set status='failed',reconciled_by=${scope.userId},reconciliation_evidence='User requested retry; prior provider outcome remains unconfirmed; undelivered attempt retired',completed_at=coalesce(completed_at,now()) where id=${item.id}`;
          await refund(tx, jobId, String(item.id));
        }
        const wallet = await ensureWallet(tx, scope);
        if (wallet.balance < imageUnitCredits * failed.length)
          throw new ImageRepositoryError("INSUFFICIENT_CREDITS");
        await tx`insert into generation_retries (organization_id,user_id,job_id,idempotency_key,target_item_id) values (${scope.organizationId},${scope.userId},${jobId},${key},${itemId ?? null})`;
        for (const item of failed) {
          await tx`update generation_job_items set superseded_at=now() where id=${item.id}`;
          const itemId = randomUUID();
          await tx`insert into generation_job_items (id,job_id,organization_id,position) values (${itemId},${jobId},${scope.organizationId},${item.position})`;
          await appendWalletEntry(tx, wallet.id, {
            eventKey: `consume:${itemId}`,
            kind: "consume",
            amount: -imageUnitCredits,
            userId: scope.userId,
            jobId,
            itemId,
          });
          await tx`insert into generation_outbox (item_id) values (${itemId})`;
        }
        await refreshJob(tx, jobId);
        return { id: jobId, replayed: false };
      });
    },
    async list(
      scope: ImageScope,
      limit: number,
      before?: string,
      tool?: "create" | "textile" | "variation",
    ) {
      await expireTimedOut(scope.organizationId);
      return sql`select ${jobView} from generation_jobs j where j.organization_id=${scope.organizationId} and j.archived_at is null
        ${tool ? sql`and ${toolMatchSql(tool)}` : sql``}
        ${before ? sql`and (j.created_at,j.id) < (select created_at,id from generation_jobs where id=${before} and organization_id=${scope.organizationId})` : sql``}
        order by j.created_at desc,j.id desc limit ${limit}`;
    },
    async archive(scope: ImageScope, id: string) {
      return sql.begin(async (tx) => {
        const rows = await tx`update generation_jobs set archived_at=coalesce(archived_at,now())
          where id=${id} and organization_id=${scope.organizationId} returning id`;
        if (!rows.length) throw new ImageRepositoryError("NOT_FOUND");
        await recordImageEvent(tx, scope.organizationId, "task", id);
      });
    },
    async getMany(scope: ImageScope, ids: string[]): Promise<Record<string, unknown>[]> {
      await expireTimedOut(scope.organizationId);
      if (!ids.length || ids.length > 50) throw new ImageRepositoryError("STATE_CONFLICT");
      return sql`select ${jobView}, exists(select 1 from generation_job_items i join provider_executions e on e.item_id=i.id
        where i.job_id=j.id and i.superseded_at is null and i.status='running' and e.phase='polling' and e.next_poll_at<=now()
        and (e.lease_until is null or e.lease_until<now())) as recovery_due
        from generation_jobs j where j.id in ${sql(ids)} and j.organization_id=${scope.organizationId}
        and exists(select 1 from organization_members where organization_id=j.organization_id and user_id=${scope.userId})`;
    },
    async get(scope: ImageScope, id: string) {
      await expireTimedOut(scope.organizationId);
      const [row] =
        await sql`select ${jobView} from generation_jobs j where j.id=${id} and j.organization_id=${scope.organizationId}`;
      return row ?? null;
    },
    async latestEdit(scope: ImageScope, sourceId: string) {
      const [source] =
        await sql`select id from media_assets where id=${sourceId} and organization_id=${scope.organizationId}`;
      if (!source) throw new ImageRepositoryError("NOT_FOUND");
      const [row] = await sql`select ${jobView} from image_local_edits e
        join generation_jobs j on j.id=e.job_id and j.organization_id=e.organization_id
        where e.organization_id=${scope.organizationId} and e.user_id=${scope.userId} and e.source_asset_id=${sourceId}
        order by e.created_at desc,e.job_id desc limit 1`;
      return row ?? null;
    },
    async addReference(scope: ImageScope, image: StoredImage) {
      await sql.begin(async (tx) => {
        await tx`insert into media_assets (id,organization_id,user_id,kind,media_type,object_key,mime_type,width,height,bytes,sha256,expires_at)
          values (${image.id},${scope.organizationId},${scope.userId},'reference','image',${image.objectKey},${image.mimeType},${image.width},${image.height},${image.bytes},${image.sha256},now()+interval '3 days')`;
        await recordImageEvent(tx, scope.organizationId, "asset", image.id);
      });
    },
    async listAssets(
      scope: ImageScope,
      limit: number,
      before?: string,
      kind?: "output" | "reference",
      type?: AssetType,
      filters: AssetFilters = {},
    ) {
      const favorite = sql`exists(select 1 from image_asset_favorites f where f.organization_id=a.organization_id
        and f.user_id=${scope.userId} and f.asset_id=a.id)`;
      return sql`select a.public_id,a.id,a.kind,a.media_type as type,a.width,a.height,a.bytes,a.created_at,j.public_id as task_public_id,${publicModelSql} as model,j.prompt,
        ${toolSql} as tool,${favorite} as favorite
        from media_assets a left join generation_job_items i on i.output_asset_id=a.id and i.organization_id=a.organization_id
        left join generation_jobs j on j.id=i.job_id and j.organization_id=a.organization_id
        where a.organization_id=${scope.organizationId} and ${visibleAssetSql}
        ${kind ? sql`and a.kind=${kind}` : sql``}
        ${type ? sql`and a.media_type=${type}` : sql``}
        ${filters.tool ? sql`and j.id is not null and ${toolMatchSql(filters.tool)}` : sql``}
        ${filters.model ? sql`and ${publicModelSql}=${filters.model}` : sql``}
        ${filters.favorite ? sql`and ${favorite}` : sql``}
        ${before ? sql`and (a.created_at,a.id) < (select created_at,id from media_assets where id=${before} and organization_id=${scope.organizationId})` : sql``}
        order by a.created_at desc,a.id desc limit ${limit}`;
    },
    /** Returns the stored state, or null when the asset is not visible to the organization. */
    async setAssetFavorite(scope: ImageScope, assetId: string, favorite: boolean) {
      return sql.begin(async (tx) => {
        const [asset] =
          await tx`select id from media_assets where id=${assetId} and organization_id=${scope.organizationId}
          and (expires_at is null or expires_at>now()) and storage_deleted_at is null`;
        if (!asset) return null;
        if (!favorite) {
          await tx`delete from image_asset_favorites where organization_id=${scope.organizationId}
            and user_id=${scope.userId} and asset_id=${assetId}`;
          return false;
        }
        // One member's favorite writes are serialized so the limit holds under concurrent requests.
        await tx`select pg_advisory_xact_lock(hashtextextended(${`${scope.organizationId}:${scope.userId}`},71421))`;
        const [existing] =
          await tx`select 1 from image_asset_favorites where organization_id=${scope.organizationId}
          and user_id=${scope.userId} and asset_id=${assetId}`;
        if (existing) return true;
        const [count] = await tx`select count(*)::integer as total from image_asset_favorites f
          join media_assets a on a.id=f.asset_id and a.organization_id=f.organization_id
          where f.organization_id=${scope.organizationId} and f.user_id=${scope.userId}
          and (a.expires_at is null or a.expires_at>now()) and a.storage_deleted_at is null`;
        if (Number(count?.total) >= assetFavoriteLimit)
          throw new ImageRepositoryError("STATE_CONFLICT");
        await tx`insert into image_asset_favorites (organization_id,user_id,asset_id)
          values (${scope.organizationId},${scope.userId},${assetId}) on conflict do nothing`;
        return true;
      });
    },
    async favoriteAssetIds(scope: ImageScope) {
      const rows = await sql`select f.asset_id from image_asset_favorites f
        join media_assets a on a.id=f.asset_id and a.organization_id=f.organization_id
        where f.organization_id=${scope.organizationId} and f.user_id=${scope.userId} and ${visibleAssetSql}
        order by f.created_at desc,f.asset_id desc limit ${assetFavoriteLimit}`;
      return rows.map((row) => String(row.asset_id));
    },
    async assetLocations(scope: ImageScope, ids: string[]) {
      if (!ids.length) return [];
      const rows =
        await sql`select id,object_key from media_assets where organization_id=${scope.organizationId} and id in ${sql(ids)} and (expires_at is null or expires_at>now()) and storage_deleted_at is null`;
      return rows.map((row) => ({ id: String(row.id), objectKey: String(row.object_key) }));
    },
    async asset(scope: ImageScope, id: string): Promise<StoredImage | null> {
      const [row] =
        await sql`select id,object_key,mime_type,width,height,bytes,sha256 from media_assets where id=${id} and organization_id=${scope.organizationId} and (expires_at is null or expires_at>now()) and storage_deleted_at is null`;
      if (!row) return null;
      return {
        id: String(row.id),
        objectKey: String(row.object_key),
        mimeType: "image/png",
        width: Number(row.width),
        height: Number(row.height),
        bytes: Number(row.bytes),
        sha256: String(row.sha256),
      };
    },
    async expiredReferences(): Promise<StoredImage[]> {
      const rows = await sql.begin(async (tx) => {
        const expired = await tx`select id,object_key,width,height,bytes,sha256 from media_assets
          where expires_at<=now() and storage_deleted_at is null order by expires_at,id limit 20 for update skip locked`;
        if (expired.length)
          await tx`update media_assets set cleanup_started_at=coalesce(cleanup_started_at,now()) where id in ${tx(expired.map((row) => String(row.id)))}`;
        return expired;
      });
      return rows.map((row) => ({
        id: String(row.id),
        objectKey: String(row.object_key),
        mimeType: "image/png",
        width: Number(row.width),
        height: Number(row.height),
        bytes: Number(row.bytes),
        sha256: String(row.sha256),
      }));
    },
    async markReferenceDeleted(id: string) {
      await sql`update media_assets set storage_deleted_at=now()
        where id=${id} and expires_at<=now() and storage_deleted_at is null`;
    },
    async leaseOutbox() {
      return sql.begin(async (tx) => {
        const rows =
          await tx`select o.id,o.item_id from generation_outbox o join generation_job_items i on i.id=o.item_id
          where (i.status='queued' or (i.status='running' and exists(select 1 from provider_executions e where e.item_id=i.id and e.phase='polling' and e.next_poll_at<=now() and (e.lease_until is null or e.lease_until<now())))) and o.next_attempt_at<=now() and (o.lease_expires_at is null or o.lease_expires_at<now())
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
    async claim(itemId: string, workerId: string, leaseMs: number): Promise<ClaimedImage | null> {
      leaseMs = Math.min(leaseMs, 90000);
      return sql.begin(async (tx) => {
        const [candidate] =
          await tx`select job_id from generation_job_items where id=${itemId} and (status='queued' or (status='running' and exists(select 1 from provider_executions e where e.item_id=${itemId} and e.phase='polling' and e.next_poll_at<=now() and (e.lease_until is null or e.lease_until<now()))))`;
        if (!candidate) return null;
        // Match completion/reconciliation lock order to avoid sibling-item deadlocks.
        await tx`select id from generation_jobs where id=${candidate.job_id} for update`;
        const [row] =
          await tx`select i.id,i.position,i.job_id,j.organization_id,j.user_id,j.input,j.provider_model,j.provider_snapshot,e.phase,e.task_id,e.status_path,e.deadline_at,e.poll_failures from generation_job_items i join generation_jobs j on j.id=i.job_id left join provider_executions e on e.item_id=i.id
          where i.id=${itemId} and (i.status='queued' or (i.status='running' and e.phase='polling' and e.next_poll_at<=now() and (e.lease_until is null or e.lease_until<now()))) for update of i skip locked`;
        if (!row) return null;
        const input = imageGenerationInputSchema.parse(row.input);
        const executionToken = randomUUID();
        const snapshot = row.provider_snapshot
          ? providerSnapshotSchema.parse(row.provider_snapshot)
          : null;
        let deadlineAt: Date | undefined;
        if (snapshot) {
          deadlineAt = row.deadline_at
            ? new Date(String(row.deadline_at))
            : new Date(Date.now() + snapshot.taskTimeoutSeconds * 1000);
          await tx`insert into provider_executions(item_id,phase,deadline_at,lease_until) values (${itemId},'submitting',${deadlineAt},now()+${leaseMs}*interval '1 millisecond') on conflict(item_id) do update set lease_until=excluded.lease_until,next_poll_at=case when provider_executions.phase='polling' then provider_executions.next_poll_at else null end,poll_count=provider_executions.poll_count+1`;
        }
        await tx`update generation_job_items set status='running',worker_id=${workerId},execution_token=${executionToken},provider=${snapshot?.adapter ?? "vakv"},attempts=attempts+case when status='queued' then 1 else 0 end,
          started_at=coalesce(started_at,now()),lease_expires_at=now()+${leaseMs} * interval '1 millisecond' where id=${itemId}`;
        await tx`update generation_jobs set status='running',updated_at=now() where id=${row.job_id}`;
        await recordImageEvent(tx, String(row.organization_id), "task", String(row.job_id));
        return {
          itemId,
          configuredProvider:
            snapshot && deadlineAt
              ? {
                  snapshot,
                  phase: String(row.phase ?? "submitting"),
                  taskId: row.task_id ? String(row.task_id) : null,
                  statusPath: row.status_path ? String(row.status_path) : null,
                  deadlineAt,
                  pollFailures: Number(row.poll_failures ?? 0),
                }
              : undefined,
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
    async finish(
      job: ClaimedImage,
      result:
        | { image: StoredImage; requestId?: string | undefined }
        | { errorCode: string; unknown: boolean; requestId?: string | undefined },
    ) {
      return sql.begin(async (tx) => {
        await tx`select id from generation_jobs where id=${job.jobId} for update`;
        const [item] =
          await tx`select status from generation_job_items where id=${job.itemId} and job_id=${job.jobId} and execution_token=${job.executionToken} and superseded_at is null for update`;
        if (
          item?.status !== "running" &&
          !(item?.status === "needs_reconciliation" && "image" in result)
        )
          return false;
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
        await refreshJob(tx, job.jobId);
        return true;
      });
    },
    async pruneEvents() {
      await sql`delete from generation_events where id in (select id from generation_events where created_at<now()-interval '7 days' order by created_at limit 1000)`;
    },
    async expireClaims() {
      await expireTimedOut();
      await settleInvalidResponses();
      // An expired paid attempt is held for operator reconciliation, never queued again.
      const rows =
        await sql`select id,job_id from generation_job_items where status='running' and lease_expires_at<now() and not exists(select 1 from provider_executions e where e.item_id=generation_job_items.id and e.phase='polling' and e.task_id is not null and e.status_path is not null and e.next_poll_at is not null and (e.deadline_at>now() or exists(select 1 from provider_webhook_tasks w where w.item_id=e.item_id))) limit 100`;
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
          await tx`select id from generation_jobs where id=${jobId} and organization_id=${scope.organizationId} for update`;
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
export type ImageRepository = ReturnType<typeof openImageRepository>;

// Runtime services do not expose provisioning, payment settlement or model-admin writes.
type PortableMethod<T> = T extends (...args: infer A) => Promise<infer R>
  ? (...args: A) => Promise<R extends readonly (infer E)[] ? E[] : R>
  : T;
export type ImageRuntimeRepository = {
  [K in Exclude<
    keyof ImageRepository,
    "provision" | "models" | "createRecharge" | "settleRecharge"
  >]: PortableMethod<ImageRepository[K]>;
} & {
  models: Pick<ImageRepository["models"], "logos" | "hasRoute" | "capabilities">;
};
