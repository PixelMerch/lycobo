import { createHash } from "node:crypto";
import type { ImageScope, StoryboardRequest, VariationPlanInput } from "@lycoboai/contracts";
import type { ImageRuntimeRepository } from "@lycoboai/db";
import {
  createPlannerWebReader,
  openProviderKey,
  PlannerError,
  PlannerWebError,
  plannerUrls,
  planVariation,
} from "@lycoboai/generation";
import { storyboardProfile } from "./storyboard-planner";

const isDeepSeek = (model: string) => /^deepseek(?:[-/]|$)/i.test(model);

export function variationService(deps: {
  repository: Pick<ImageRuntimeRepository, "variation" | "asset">;
  modelSecret?: string | undefined;
  plannerKey?: string | undefined;
  plannerRequest?: typeof fetch | undefined;
}) {
  const readWeb = createPlannerWebReader(deps.plannerRequest);
  const service = {
    async enabled() {
      return (
        !!(deps.plannerKey || deps.modelSecret) && !!(await deps.repository.variation.config())
      );
    },
    async create(
      scope: ImageScope,
      input: VariationPlanInput,
      key: string,
      signal: AbortSignal,
      onText?: (text: string) => Promise<void>,
      onStatus?: (stage: "reading" | "planning" | "link_failed") => Promise<void>,
      storyboard?: StoryboardRequest,
    ) {
      const config = await deps.repository.variation.config();
      if (!config || (!deps.plannerKey && !deps.modelSecret)) return null;
      if (storyboard && !isDeepSeek(config.model)) return null;
      const result = await deps.repository.variation.begin(scope, input, key);
      if (result.replayed) return result.plan;
      try {
        // Keep ownership checks without reading or encoding image content for the planner.
        await Promise.all(
          [
            ...input.referenceAssetIds,
            ...(storyboard?.stage === "video" ? storyboard.shots.map((shot) => shot.assetId) : []),
          ].map(async (id) => {
            if (!(await deps.repository.asset(scope, id)))
              throw new PlannerError("PLANNER_INVALID_RESULT");
          }),
        );
        const secret =
          deps.plannerKey ?? (await openProviderKey(config.ciphertext, deps.modelSecret ?? ""));
        const urls = storyboard ? [] : plannerUrls(input.description);
        let webContext: string | undefined;
        if (urls.length) {
          await onStatus?.("reading");
          if (new URL(config.origin).origin !== "https://api.deepseek.com")
            throw new PlannerWebError();
          webContext = await readWeb(
            urls,
            secret,
            `${scope.organizationId}:${scope.userId}`,
            signal,
          );
        }
        await onStatus?.("planning");
        const items = await planVariation(
          input,
          { ...config, key: secret },
          result.plan.id,
          signal,
          deps.plannerRequest,
          onText,
          webContext,
          storyboard && storyboardProfile(storyboard),
        );
        await deps.repository.variation.finish(scope, result.plan.id, items);
      } catch (error) {
        await deps.repository.variation.finish(
          scope,
          result.plan.id,
          [],
          error instanceof PlannerError
            ? error.code
            : error instanceof PlannerWebError
              ? "PLANNER_WEB_FAILED"
              : "PLANNER_INVALID_RESULT",
        );
        if (error instanceof PlannerWebError) await onStatus?.("link_failed");
      }
      return deps.repository.variation.get(scope, result.plan.id);
    },
  };
  return {
    ...service,
    async storyboardEnabled() {
      if (!deps.plannerKey && !deps.modelSecret) return false;
      const config = await deps.repository.variation.config();
      return !!config && isDeepSeek(config.model);
    },
    createStoryboard(
      scope: ImageScope,
      input: StoryboardRequest,
      key: string,
      signal: AbortSignal,
    ) {
      return service.create(
        scope,
        {
          description: `TK分镜 ${input.stage} ${createHash("sha256").update(JSON.stringify(input)).digest("hex")}\n${input.description.slice(0, 4800)}`,
          referenceAssetIds: [input.originalAssetId],
        },
        key,
        signal,
        undefined,
        undefined,
        input,
      );
    },
  };
}
