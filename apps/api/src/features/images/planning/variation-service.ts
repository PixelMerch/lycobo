import { createHash } from "node:crypto";
import {
  type ImageScope,
  type StoryboardRequest,
  storyboardOriginals,
  type VariationPlanInput,
} from "@lycoboai/contracts";
import type { ImageRuntimeRepository } from "@lycoboai/db";
import {
  createPlannerWebReader,
  openProviderKey,
  PlannerError,
  PlannerWebError,
  plannerUrls,
  planVariation,
} from "@lycoboai/generation";
import { storyboardProfile } from "../../videos/storyboard-planner";

const isDeepSeek = (model: string) => /^deepseek(?:[-/]|$)/i.test(model);

function planningErrorCode(error: unknown) {
  if (error instanceof PlannerError) return error.code;
  return error instanceof PlannerWebError ? "PLANNER_WEB_FAILED" : "PLANNER_INVALID_RESULT";
}

async function verifyPlanningAssets(
  repository: Pick<ImageRuntimeRepository, "asset">,
  scope: ImageScope,
  references: string[],
  storyboard?: StoryboardRequest,
) {
  const shots = storyboard?.stage === "video" ? storyboard.shots.map((shot) => shot.assetId) : [];
  await Promise.all(
    [...references, ...shots].map(async (id) => {
      if (!(await repository.asset(scope, id))) throw new PlannerError("PLANNER_INVALID_RESULT");
    }),
  );
}

/** 编排网页和分镜的规划模型调用，并保存可继续生成的方案。 */
export function variationService(deps: {
  repository: Pick<ImageRuntimeRepository, "asset"> & {
    variation: Pick<ImageRuntimeRepository["variation"], "config" | "begin" | "finish" | "get">;
  };
  modelSecret?: string | undefined;
  plannerKey?: string | undefined;
  plannerRequest?: typeof fetch | undefined;
}) {
  const hasCredentials = () => !!(deps.plannerKey || deps.modelSecret);
  const readWeb = createPlannerWebReader(deps.plannerRequest);
  async function readPlannerKey(ciphertext: string) {
    return deps.plannerKey ?? openProviderKey(ciphertext, deps.modelSecret ?? "");
  }
  async function readPlanningContext(
    input: VariationPlanInput,
    storyboard: StoryboardRequest | undefined,
    origin: string,
    secret: string,
    scope: ImageScope,
    signal: AbortSignal,
    onStatus?: (stage: "reading") => Promise<void>,
  ) {
    const urls = storyboard ? [] : plannerUrls(input.description);
    if (!urls.length) return undefined;
    await onStatus?.("reading");
    if (new URL(origin).origin !== "https://api.deepseek.com") throw new PlannerWebError();
    return readWeb(urls, secret, `${scope.organizationId}:${scope.userId}`, signal);
  }
  const service = {
    async enabled() {
      return hasCredentials() && !!(await deps.repository.variation.config());
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
      if (!config || !hasCredentials()) return null;
      if (storyboard && !isDeepSeek(config.model)) return null;
      const result = await deps.repository.variation.begin(scope, input, key);
      if (result.replayed) return result.plan;
      try {
        // 规划前只校验素材归属，无需读取或编码图片内容。
        await verifyPlanningAssets(deps.repository, scope, input.referenceAssetIds, storyboard);
        const secret = await readPlannerKey(config.ciphertext);
        const webContext = await readPlanningContext(
          input,
          storyboard,
          config.origin,
          secret,
          scope,
          signal,
          onStatus,
        );
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
        await deps.repository.variation.finish(scope, result.plan.id, [], planningErrorCode(error));
        if (error instanceof PlannerWebError) await onStatus?.("link_failed");
      }
      return deps.repository.variation.get(scope, result.plan.id);
    },
  };
  return {
    ...service,
    async storyboardEnabled() {
      if (!hasCredentials()) return false;
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
          referenceAssetIds: storyboardOriginals(input),
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
