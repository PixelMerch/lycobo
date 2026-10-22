import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  type AssetType,
  type ImageGenerationInput,
  type ImageScope,
  imageGenerationInputSchema,
  imageProviderModel,
  imageUnitCredits,
  type StoredImage,
} from "@lycoboai/contracts";
import postgres from "postgres";
import { recordImageEvent } from "./image-event-repository";
import { appendWalletEntry, ensureWallet, walletRepository } from "./wallet-repository";

export class ImageRepositoryError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
export type ImagePrincipal = ImageScope & { role: "admin" | "member"; uid?: string };
export type ClaimedImage = {
  itemId: string;
  jobId: string;
  organizationId: string;
  userId: string;
  executionToken: string;
  input: ImageGenerationInput;
  providerModel: ImageGenerationInput["model"];
};
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export function openImageRepository(url: string) {
  const sql = postgres(url, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    connection: { statement_timeout: 15000, lock_timeout: 5000 },
  });
  const refreshJob = async (tx: postgres.TransactionSql, jobId: string) => {
    await tx`update image_jobs j set status = case
      when exists(select 1 from image_job_items i where i.job_id=j.id and i.superseded_at is null and i.status='running') then 'running'
      when exists(select 1 from image_job_items i where i.job_id=j.id and i.superseded_at is null and i.status='queued') then 'queued'
      when exists(select 1 from image_job_items i where i.job_id=j.id and i.superseded_at is null and i.status='needs_reconciliation') then 'needs_reconciliation'
      when not exists(select 1 from image_job_items i where i.job_id=j.id and i.superseded_at is null and i.status <> 'succeeded') then 'succeeded'
      when exists(select 1 from image_job_items i where i.job_id=j.id and i.superseded_at is null and i.status='succeeded') then 'partially_failed'
      else 'failed' end, updated_at=now(), completed_at=case
      when exists(select 1 from image_job_items i where i.job_id=j.id and i.superseded_at is null and i.status in ('running','queued','needs_reconciliation')) then null
      else now() end where j.id=${jobId}`;
    const [job] = await tx`select organization_id from image_jobs where id=${jobId}`;
    if (job) await recordImageEvent(tx, String(job.organization_id), "task", jobId);
  };
  const refund = async (tx: postgres.TransactionSql, jobId: string, itemId: string) => {
    const credits =
      await tx`insert into image_credit_ledger (organization_id,job_id,item_id,event_type,amount)
      select organization_id,id,${itemId},'refund',unit_credits from image_jobs where id=${jobId}
      on conflict do nothing returning organization_id,amount`;
    const credit = credits[0];
    if (credit) {
      const [job] = await tx`select user_id from image_jobs where id=${jobId}`;
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
      await sql`select id,job_id from image_job_items where status='needs_reconciliation' and error_code='PROVIDER_INVALID_IMAGE_RESPONSE' and superseded_at is null limit 100`;
    for (const row of rows)
      await sql.begin(async (tx) => {
        await tx`select id from image_jobs where id=${row.job_id} for update`;
        const changed =
          await tx`update image_job_items set status='failed',reconciliation_evidence='Invalid response: no usable image delivered',completed_at=coalesce(completed_at,now()) where id=${row.id} and status='needs_reconciliation' and error_code='PROVIDER_INVALID_IMAGE_RESPONSE' returning id`;
        if (!changed.length) return;
        await refund(tx, String(row.job_id), String(row.id));
        await refreshJob(tx, String(row.job_id));
      });
  };
  const publicModelSql = sql`case when j.model in ('nano-banana-2.1','gemini-nano-banana-2.1') then 'nano-banana-2.1'
    when j.model in ('gpt-image-2.5','gpt-image-2.5-flare','gpt-image-2.5-sunburst') then 'gpt-image-2.5'
    when j.model in ('gpt-image-2','gpt-image-2-4K') then 'gpt-image-2' else j.model end`;
  const jobView = sql`j.public_id,j.id,j.organization_id,j.user_id,${publicModelSql} as model,j.prompt,j.resolution,j.aspect_ratio,
    j.requested_count,j.unit_credits,j.status,j.input,j.created_at,j.updated_at,j.completed_at,
    (select coalesce(json_agg(json_build_object('id',i.id,'position',i.position,'status',i.status,
      'worker_id',i.worker_id,'provider',i.provider,'provider_request_id',i.provider_request_id,
      'attempts',i.attempts,'error_code',i.error_code,'started_at',i.started_at,'completed_at',i.completed_at,
      'output_asset_id',i.output_asset_id,'output_public_id',a.public_id,'width',a.width,'height',a.height,'bytes',a.bytes) order by i.position),'[]')
      from image_job_items i left join image_assets a on a.id=i.output_asset_id and a.organization_id=i.organization_id where i.job_id=j.id and i.superseded_at is null) as items`;
  return {
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
          await tx`insert into image_api_keys (organization_id,user_id,token_hash,expires_at)
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
    async authenticate(token: string): Promise<ImagePrincipal | null> {
      if (!/^[\w-]{43}$/.test(token)) return null;
      const [row] = await sql`select k.user_id,k.organization_id,m.role,u.uid from image_api_keys k
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
    ) {
      const unitCredits = imageUnitCredits;
      const inputHash = hash(JSON.stringify(input));
      return sql.begin(async (tx) => {
        const members =
          await tx`select user_id from organization_members where organization_id=${scope.organizationId} and user_id=${scope.userId} for share`;
        if (!members.length) throw new ImageRepositoryError("FORBIDDEN");
        const inserted =
          await tx`insert into image_jobs (organization_id,user_id,idempotency_key,input_hash,input,model,provider_model,prompt,resolution,aspect_ratio,requested_count,unit_credits)
          values (${scope.organizationId},${scope.userId},${key},${inputHash},${tx.json(input)},${input.model},${imageProviderModel(input)},${input.prompt},${input.resolution},${input.aspectRatio},${input.count},${unitCredits})
          on conflict (organization_id,user_id,idempotency_key) do nothing returning id`;
        if (!inserted[0]) {
          const [existing] =
            await tx`select id,input_hash from image_jobs where organization_id=${scope.organizationId} and user_id=${scope.userId} and idempotency_key=${key}`;
          if (!existing || existing.input_hash !== inputHash)
            throw new ImageRepositoryError("IDEMPOTENCY_CONFLICT");
          return { id: String(existing.id), replayed: true };
        }
        const id = String(inserted[0].id);
        if (input.referenceAssetIds.length) {
          const refs =
            await tx`select id,width,height from image_assets where organization_id=${scope.organizationId} and id in ${tx(input.referenceAssetIds)}`;
          if (refs.length !== input.referenceAssetIds.length)
            throw new ImageRepositoryError("REFERENCE_NOT_FOUND");
        }
        if (input.localEdit) {
          const edit = input.localEdit;
          const [source] =
            await tx`select width,height from image_assets where id=${edit.sourceAssetId} and organization_id=${scope.organizationId}`;
          if (
            !source ||
            Number(source.width) !== edit.width ||
            Number(source.height) !== edit.height
          )
            throw new ImageRepositoryError("REFERENCE_NOT_FOUND");
          await tx`insert into image_local_edits (job_id,organization_id,user_id,source_asset_id)
            values (${id},${scope.organizationId},${scope.userId},${edit.sourceAssetId})`;
        }
        const total = unitCredits * input.count;
        const wallet = await ensureWallet(tx, scope);
        if (wallet.balance < total) throw new ImageRepositoryError("INSUFFICIENT_CREDITS");
        await tx`insert into image_credit_ledger (organization_id,job_id,event_type,amount) values (${scope.organizationId},${id},'reserve',${-total})`;
        for (let position = 0; position < input.count; position++) {
          const itemId = randomUUID();
          await tx`insert into image_job_items (id,job_id,organization_id,position) values (${itemId},${id},${scope.organizationId},${position})`;
          await appendWalletEntry(tx, wallet.id, {
            eventKey: `consume:${itemId}`,
            kind: "consume",
            amount: -unitCredits,
            userId: scope.userId,
            jobId: id,
            itemId,
          });
          await tx`insert into image_outbox (item_id) values (${itemId})`;
        }
        await recordImageEvent(tx, scope.organizationId, "task", id);
        return { id, replayed: false };
      });
    },
    async retry(scope: ImageScope, jobId: string, key: string) {
      return sql.begin(async (tx) => {
        const members =
          await tx`select user_id from organization_members where organization_id=${scope.organizationId} and user_id=${scope.userId} for share`;
        if (!members.length) throw new ImageRepositoryError("FORBIDDEN");
        const [job] =
          await tx`select id,status,unit_credits from image_jobs where id=${jobId} and organization_id=${scope.organizationId} for update`;
        if (!job) throw new ImageRepositoryError("NOT_FOUND");
        const [previous] =
          await tx`select job_id from image_retries where organization_id=${scope.organizationId} and user_id=${scope.userId} and idempotency_key=${key}`;
        if (previous) {
          if (previous.job_id !== jobId) throw new ImageRepositoryError("IDEMPOTENCY_CONFLICT");
          return { id: jobId, replayed: true };
        }
        const items =
          await tx`select id,position,status,error_code from image_job_items where job_id=${jobId} and superseded_at is null order by position for update`;
        if (items.some((i) => i.status === "queued" || i.status === "running"))
          throw new ImageRepositoryError("STATE_CONFLICT");
        const failed = items.filter(
          (i) => i.status === "failed" || i.status === "needs_reconciliation",
        );
        if (!failed.length) throw new ImageRepositoryError("STATE_CONFLICT");
        // Explicit user retry retires unresolved attempts before refund/recharge.
        // Keep the uncertain provider outcome as evidence; do not call this
        // reconciliation proof or let a late completion replace the new attempt.
        for (const item of failed) {
          if (item.status === "needs_reconciliation")
            await tx`update image_job_items set status='failed',reconciled_by=${scope.userId},reconciliation_evidence='User requested retry; prior provider outcome remains unconfirmed; undelivered attempt retired',completed_at=coalesce(completed_at,now()) where id=${item.id}`;
          await refund(tx, jobId, String(item.id));
        }
        const wallet = await ensureWallet(tx, scope);
        if (wallet.balance < Number(job.unit_credits) * failed.length)
          throw new ImageRepositoryError("INSUFFICIENT_CREDITS");
        await tx`insert into image_retries (organization_id,user_id,job_id,idempotency_key) values (${scope.organizationId},${scope.userId},${jobId},${key})`;
        for (const item of failed) {
          await tx`update image_job_items set superseded_at=now() where id=${item.id}`;
          const itemId = randomUUID();
          await tx`insert into image_job_items (id,job_id,organization_id,position) values (${itemId},${jobId},${scope.organizationId},${item.position})`;
          await appendWalletEntry(tx, wallet.id, {
            eventKey: `consume:${itemId}`,
            kind: "consume",
            amount: -Number(job.unit_credits),
            userId: scope.userId,
            jobId,
            itemId,
          });
          await tx`insert into image_outbox (item_id) values (${itemId})`;
        }
        await refreshJob(tx, jobId);
        return { id: jobId, replayed: false };
      });
    },
    async list(scope: ImageScope, limit: number, before?: string) {
      return sql`select ${jobView} from image_jobs j where j.organization_id=${scope.organizationId}
        ${before ? sql`and (j.created_at,j.id) < (select created_at,id from image_jobs where id=${before} and organization_id=${scope.organizationId})` : sql``}
        order by j.created_at desc,j.id desc limit ${limit}`;
    },
    async get(scope: ImageScope, id: string) {
      const [row] =
        await sql`select ${jobView} from image_jobs j where j.id=${id} and j.organization_id=${scope.organizationId}`;
      return row ?? null;
    },
    async latestEdit(scope: ImageScope, sourceId: string) {
      const [source] =
        await sql`select id from image_assets where id=${sourceId} and organization_id=${scope.organizationId}`;
      if (!source) throw new ImageRepositoryError("NOT_FOUND");
      const [row] = await sql`select ${jobView} from image_local_edits e
        join image_jobs j on j.id=e.job_id and j.organization_id=e.organization_id
        where e.organization_id=${scope.organizationId} and e.user_id=${scope.userId} and e.source_asset_id=${sourceId}
        order by e.created_at desc,e.job_id desc limit 1`;
      return row ?? null;
    },
    async addReference(scope: ImageScope, image: StoredImage) {
      await sql.begin(async (tx) => {
        await tx`insert into image_assets (id,organization_id,user_id,kind,media_type,object_key,mime_type,width,height,bytes,sha256)
          values (${image.id},${scope.organizationId},${scope.userId},'reference','image',${image.objectKey},${image.mimeType},${image.width},${image.height},${image.bytes},${image.sha256})`;
        await recordImageEvent(tx, scope.organizationId, "asset", image.id);
      });
    },
    async listAssets(
      scope: ImageScope,
      limit: number,
      before?: string,
      kind?: "output" | "reference",
      type?: AssetType,
    ) {
      return sql`select a.public_id,a.id,a.kind,a.media_type as type,a.width,a.height,a.bytes,a.created_at,j.public_id as task_public_id,${publicModelSql} as model,j.prompt
        from image_assets a left join image_job_items i on i.output_asset_id=a.id and i.organization_id=a.organization_id
        left join image_jobs j on j.id=i.job_id and j.organization_id=a.organization_id
        where a.organization_id=${scope.organizationId}
        ${kind ? sql`and a.kind=${kind}` : sql``}
        ${type ? sql`and a.media_type=${type}` : sql``}
        ${before ? sql`and (a.created_at,a.id) < (select created_at,id from image_assets where id=${before} and organization_id=${scope.organizationId})` : sql``}
        order by a.created_at desc,a.id desc limit ${limit}`;
    },
    async asset(scope: ImageScope, id: string): Promise<StoredImage | null> {
      const [row] =
        await sql`select id,object_key,mime_type,width,height,bytes,sha256 from image_assets where id=${id} and organization_id=${scope.organizationId}`;
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
    async leaseOutbox() {
      return sql.begin(async (tx) => {
        const rows =
          await tx`select o.id,o.item_id from image_outbox o join image_job_items i on i.id=o.item_id
          where i.status='queued' and o.next_attempt_at<=now() and (o.lease_expires_at is null or o.lease_expires_at<now())
          order by o.next_attempt_at limit 20 for update of o skip locked`;
        const result: Array<{ id: string; itemId: string; leaseToken: string }> = [];
        for (const row of rows) {
          const token = randomUUID();
          await tx`update image_outbox set lease_token=${token},lease_expires_at=now()+interval '30 seconds' where id=${row.id}`;
          result.push({ id: String(row.id), itemId: String(row.item_id), leaseToken: token });
        }
        return result;
      });
    },
    async ackOutbox(id: string, token: string) {
      await sql`update image_outbox set dispatched_at=coalesce(dispatched_at,now()),next_attempt_at=now()+interval '30 seconds',
        lease_token=null,lease_expires_at=null where id=${id} and lease_token=${token}`;
    },
    async claim(itemId: string, workerId: string, leaseMs: number): Promise<ClaimedImage | null> {
      return sql.begin(async (tx) => {
        const [candidate] =
          await tx`select job_id from image_job_items where id=${itemId} and status='queued'`;
        if (!candidate) return null;
        // Match completion/reconciliation lock order to avoid sibling-item deadlocks.
        await tx`select id from image_jobs where id=${candidate.job_id} for update`;
        const [row] =
          await tx`select i.id,i.job_id,j.organization_id,j.user_id,j.input,j.provider_model from image_job_items i join image_jobs j on j.id=i.job_id
          where i.id=${itemId} and i.status='queued' for update of i skip locked`;
        if (!row) return null;
        const input = imageGenerationInputSchema.parse(row.input);
        const executionToken = randomUUID();
        await tx`update image_job_items set status='running',worker_id=${workerId},execution_token=${executionToken},attempts=attempts+1,
          started_at=now(),lease_expires_at=now()+${leaseMs} * interval '1 millisecond' where id=${itemId}`;
        await tx`update image_jobs set status='running',updated_at=now() where id=${row.job_id}`;
        await recordImageEvent(tx, String(row.organization_id), "task", String(row.job_id));
        return {
          itemId,
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
    async finish(
      job: ClaimedImage,
      result:
        | { image: StoredImage; requestId?: string | undefined }
        | { errorCode: string; unknown: boolean; requestId?: string | undefined },
    ) {
      return sql.begin(async (tx) => {
        await tx`select id from image_jobs where id=${job.jobId} for update`;
        const [item] =
          await tx`select status from image_job_items where id=${job.itemId} and job_id=${job.jobId} and execution_token=${job.executionToken} and superseded_at is null for update`;
        if (
          item?.status !== "running" &&
          !(item?.status === "needs_reconciliation" && "image" in result)
        )
          return false;
        if ("image" in result) {
          const a = result.image;
          await tx`insert into image_assets (id,organization_id,user_id,kind,media_type,object_key,mime_type,width,height,bytes,sha256)
            values (${a.id},${job.organizationId},${job.userId},'output','image',${a.objectKey},${a.mimeType},${a.width},${a.height},${a.bytes},${a.sha256})`;
          await tx`update image_job_items set status='succeeded',output_asset_id=${a.id},provider_request_id=${result.requestId ?? null},completed_at=now() where id=${job.itemId}`;
        } else {
          await tx`update image_job_items set status=${result.unknown && result.errorCode !== "PROVIDER_INVALID_IMAGE_RESPONSE" ? "needs_reconciliation" : "failed"},error_code=${result.errorCode},
            provider_request_id=${result.requestId ?? null},completed_at=now() where id=${job.itemId}`;
          if (!result.unknown || result.errorCode === "PROVIDER_INVALID_IMAGE_RESPONSE")
            await refund(tx, job.jobId, job.itemId);
        }
        await refreshJob(tx, job.jobId);
        return true;
      });
    },
    async pruneEvents() {
      await sql`delete from image_events where id in (select id from image_events where created_at<now()-interval '7 days' order by created_at limit 1000)`;
    },
    async expireClaims() {
      await settleInvalidResponses();
      // An expired paid attempt is held for operator reconciliation, never queued again.
      const rows =
        await sql`select id,job_id from image_job_items where status='running' and lease_expires_at<now() limit 100`;
      for (const row of rows)
        await sql.begin(async (tx) => {
          await tx`select id from image_jobs where id=${row.job_id} for update`;
          await tx`update image_job_items set status='needs_reconciliation',error_code='WORKER_OUTCOME_UNKNOWN',completed_at=now()
          where id=${row.id} and status='running' and lease_expires_at<now()`;
          await refreshJob(tx, String(row.job_id));
        });
    },
    async reconcile(scope: ImageScope, jobId: string, itemId: string, evidence: string) {
      return sql.begin(async (tx) => {
        const admins =
          await tx`select user_id from organization_members where organization_id=${scope.organizationId} and user_id=${scope.userId} and role='admin' for share`;
        if (!admins.length) throw new ImageRepositoryError("FORBIDDEN");
        const jobs =
          await tx`select id from image_jobs where id=${jobId} and organization_id=${scope.organizationId} for update`;
        if (!jobs.length) throw new ImageRepositoryError("NOT_FOUND");
        const changed =
          await tx`update image_job_items set status='failed',error_code='RECONCILED_FAILED',reconciled_by=${scope.userId},reconciliation_evidence=${evidence},completed_at=now()
          where id=${itemId} and job_id=${jobId} and status='needs_reconciliation' returning id`;
        if (!changed.length) throw new ImageRepositoryError("STATE_CONFLICT");
        await refund(tx, jobId, itemId);
        await refreshJob(tx, jobId);
      });
    },
  };
}
export type ImageRepository = ReturnType<typeof openImageRepository>;
