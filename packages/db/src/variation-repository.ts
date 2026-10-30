import { createHash } from "node:crypto";
import {
  type ImageScope,
  providerOriginSchema,
  type VariationPlanInput,
  variationPlanItemSchema,
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
export function variationRepository(sql: postgres.Sql) {
  const view = (row: postgres.Row) => {
    const input = z
      .object({ description: z.string(), referenceAssetIds: z.array(z.uuid()) })
      .parse(row.input);
    return variationPlanSchema.parse({
      id: row.id,
      status: row.status,
      ...input,
      items: row.items,
    });
  };
  return {
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
        if (prior) {
          if (prior.input_hash !== hash) throw new VariationError("IDEMPOTENCY_CONFLICT");
          return { plan: view(prior), replayed: true };
        }
        const [recent] =
          await tx`select count(*)::integer as count from variation_plans where organization_id=${scope.organizationId} and user_id=${scope.userId} and created_at>now()-interval '1 minute'`;
        if (Number(recent?.count) >= 3) throw new VariationError("RATE_LIMITED");
        if (input.referenceAssetIds.length) {
          const assets =
            await tx`select id from media_assets where organization_id=${scope.organizationId} and id in ${tx(input.referenceAssetIds)} and (expires_at is null or expires_at>now()) and cleanup_started_at is null`;
          if (assets.length !== input.referenceAssetIds.length)
            throw new VariationError("REFERENCE_NOT_FOUND");
        }
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
      const checked = z.array(variationPlanItemSchema).max(10).parse(items);
      await sql`update variation_plans set status=${errorCode ? (errorCode === "PLANNER_OUTCOME_UNKNOWN" ? "uncertain" : "failed") : "ready"},items=${sql.json(checked)},error_code=${errorCode ?? null}
        where id=${id} and organization_id=${scope.organizationId} and user_id=${scope.userId} and status='running'`;
    },
  };
}
