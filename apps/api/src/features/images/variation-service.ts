import type { ImageScope, VariationPlanInput } from "@lycoboai/contracts";
import type { ImageRepository } from "@lycoboai/db";
import { openProviderKey, PlannerError, planVariation } from "@lycoboai/generation";
import type { ImageStore } from "@lycoboai/storage/core";

export function variationService(deps: {
  repository: ImageRepository;
  store: ImageStore;
  modelSecret?: string | undefined;
  plannerRequest?: typeof fetch | undefined;
}) {
  return {
    async enabled() {
      return !!deps.modelSecret && !!(await deps.repository.variation.config());
    },
    async create(scope: ImageScope, input: VariationPlanInput, key: string, signal: AbortSignal) {
      const config = await deps.repository.variation.config();
      if (!config || !deps.modelSecret) return null;
      const result = await deps.repository.variation.begin(scope, input, key);
      if (result.replayed) return result.plan;
      try {
        const images: Uint8Array[] = [];
        for (const id of input.referenceAssetIds) {
          const asset = await deps.repository.asset(scope, id);
          if (!asset) throw new PlannerError("PLANNER_INVALID_RESULT");
          images.push(await deps.store.thumbnail(asset));
        }
        const secret = await openProviderKey(config.ciphertext, deps.modelSecret);
        const items = await planVariation(
          input,
          images,
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
