import type { ImageScope, VariationPlanInput } from "@lycoboai/contracts";
import type { ImageRuntimeRepository } from "@lycoboai/db";
import { openProviderKey, PlannerError, planVariation } from "@lycoboai/generation";
import type { ImageStore } from "@lycoboai/storage/core";

export function variationService(deps: {
  repository: ImageRuntimeRepository;
  store: ImageStore;
  modelSecret?: string | undefined;
  plannerKey?: string | undefined;
  plannerRequest?: typeof fetch | undefined;
}) {
  return {
    async enabled() {
      return (
        !!(deps.plannerKey || deps.modelSecret) && !!(await deps.repository.variation.config())
      );
    },
    async create(scope: ImageScope, input: VariationPlanInput, key: string, signal: AbortSignal) {
      const config = await deps.repository.variation.config();
      if (!config || (!deps.plannerKey && !deps.modelSecret)) return null;
      const result = await deps.repository.variation.begin(scope, input, key);
      if (result.replayed) return result.plan;
      try {
        // Keep ownership checks without reading or encoding image content for the planner.
        await Promise.all(
          input.referenceAssetIds.map(async (id) => {
            if (!(await deps.repository.asset(scope, id)))
              throw new PlannerError("PLANNER_INVALID_RESULT");
          }),
        );
        const secret =
          deps.plannerKey ?? (await openProviderKey(config.ciphertext, deps.modelSecret ?? ""));
        const items = await planVariation(
          input,
          { ...config, key: secret },
          result.plan.id,
          signal,
          deps.plannerRequest,
        );
        await deps.repository.variation.finish(scope, result.plan.id, items);
      } catch (error) {
        await deps.repository.variation.finish(
          scope,
          result.plan.id,
          [],
          error instanceof PlannerError ? error.code : "PLANNER_INVALID_RESULT",
        );
      }
      return deps.repository.variation.get(scope, result.plan.id);
    },
  };
}
