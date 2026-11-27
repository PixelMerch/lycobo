import { createHash } from "node:crypto";
import {
  type ImageAutomationSetInput,
  type ImageScope,
  providerOriginSchema,
  type VariationPlanInput,
  variationPlanInputSchema,
  variationPlanItemSchema,
  variationPlanLimit,
  variationPlanSchema,
} from "@lycoboai/contracts";
import type postgres from "postgres";
import { z } from "zod";

export class VariationError extends Error {
  constructor(
    readonly code:
      | "RATE_LIMITED"
      | "NOT_FOUND"
      | "IDEMPOTENCY_CONFLICT"
      | "REFERENCE_NOT_FOUND"
      | "STATE_CONFLICT",
  ) {
    super(code);
  }
}
async function verifyPlanReferences(
  tx: postgres.TransactionSql,
  scope: ImageScope,
  referenceIds: string[],
) {
  if (referenceIds.length) {
    const assets =
      await tx`select id from media_assets where organization_id=${scope.organizationId} and id in ${tx(referenceIds)} and (expires_at is null or expires_at>now()) and cleanup_started_at is null`;
    if (assets.length !== referenceIds.length) throw new VariationError("REFERENCE_NOT_FOUND");
  }
}

/** 按组织和用户保存规划请求、幂等结果及模型配置。 */
export function variationRepository(sql: postgres.Sql) {
  const view = (row: postgres.Row) => {
    const input = variationPlanInputSchema.parse(row.input);
    return variationPlanSchema.parse({
      id: row.id,
      status: row.status,
      ...input,
      items: row.items,
    });
  };
  const replayVariation = (prior: postgres.Row, hash: string) => {
    if (prior.input_hash !== hash) throw new VariationError("IDEMPOTENCY_CONFLICT");
    return { plan: view(prior), replayed: true };
  };
  return {
    async saveAutomationPlan(scope: ImageScope, set: ImageAutomationSetInput, key: string) {
      const input = variationPlanInputSchema.parse({
        description: `${set.title}（MCP）`,
        referenceAssetIds: [],
      });
      const items = set.images.map((image) => ({ ...image, id: crypto.randomUUID() }));
      // 同一请求复用已保存的方案和图片 ID。豆包已提供逐图方案，无需调用规划模型。
      const hash = createHash("sha256").update(JSON.stringify(set)).digest("hex");
      const [inserted] =
        await sql`insert into variation_plans(organization_id,user_id,idempotency_key,input_hash,input,items,status)
        values(${scope.organizationId},${scope.userId},${key},${hash},${sql.json(input)},${sql.json(items)},'ready')
        on conflict (organization_id,user_id,idempotency_key) do nothing returning *`;
      if (inserted) return view(inserted);
      const [prior] = await sql`select * from variation_plans
        where organization_id=${scope.organizationId} and user_id=${scope.userId} and idempotency_key=${key}`;
      if (!prior) throw new VariationError("STATE_CONFLICT");
      return replayVariation(prior, hash).plan;
    },
    async config() {
      const [row] = await sql`select p.origin,p.protocol,p.upstream_model,p.timeout_ms,c.ciphertext
        from model_planners p join model_providers m on m.id=p.provider_id join model_credentials c on c.id=m.credential_id
        where p.tool='smart-variation' and p.enabled=1 and m.enabled=1`;
      if (!row) return null;
      return {
        origin: providerOriginSchema.parse(row.origin),
        model: String(row.upstream_model),
        protocol: z.enum(["openai-chat", "anthropic-messages"]).parse(row.protocol),
        timeoutMs: Number(row.timeout_ms),
        ciphertext: String(row.ciphertext),
      };
    },
    async begin(scope: ImageScope, input: VariationPlanInput, key: string) {
      const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
      return sql.begin(async (tx) => {
        const members =
          await tx`select user_id from organization_members where organization_id=${scope.organizationId} and user_id=${scope.userId} for update`;
        if (!members.length) throw new VariationError("NOT_FOUND");
        await tx`update variation_plans set status='uncertain',error_code='PLANNER_OUTCOME_UNKNOWN' where organization_id=${scope.organizationId} and user_id=${scope.userId} and status='running' and created_at<now()-interval '120 seconds'`;
        const [prior] =
          await tx`select * from variation_plans where organization_id=${scope.organizationId} and user_id=${scope.userId} and idempotency_key=${key}`;
        if (prior) return replayVariation(prior, hash);

        const [recent] =
          await tx`select count(*)::integer as count from variation_plans where organization_id=${scope.organizationId} and user_id=${scope.userId} and created_at>now()-interval '1 minute'`;
        if (Number(recent?.count) >= 3) throw new VariationError("RATE_LIMITED");
        await verifyPlanReferences(tx, scope, input.referenceAssetIds);
        const [row] =
          await tx`insert into variation_plans(organization_id,user_id,idempotency_key,input_hash,input) values(${scope.organizationId},${scope.userId},${key},${hash},${tx.json(input)}) returning *`;
        if (!row) throw new Error("PLAN_PERSIST_FAILED");
        return { plan: view(row), replayed: false };
      });
    },
    async get(scope: ImageScope, id: string) {
      await sql`update variation_plans set status='uncertain',error_code='PLANNER_OUTCOME_UNKNOWN' where id=${id} and organization_id=${scope.organizationId} and user_id=${scope.userId} and status='running' and created_at<now()-interval '120 seconds'`;
      const [row] =
        await sql`select * from variation_plans where id=${id} and organization_id=${scope.organizationId} and user_id=${scope.userId}`;
      return row ? view(row) : null;
    },
    async finish(scope: ImageScope, id: string, items: unknown, errorCode?: string) {
      const checked = z.array(variationPlanItemSchema).max(variationPlanLimit).parse(items);
      const failureStatus = errorCode === "PLANNER_OUTCOME_UNKNOWN" ? "uncertain" : "failed";
      const status = errorCode ? failureStatus : "ready";
      await sql`update variation_plans set status=${status},items=${sql.json(checked)},error_code=${errorCode ?? null}
        where id=${id} and organization_id=${scope.organizationId} and user_id=${scope.userId} and status='running'`;
    },
  };
}
