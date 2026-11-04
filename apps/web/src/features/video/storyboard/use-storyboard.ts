import {
  imageJobSchema,
  imageUnitCredits,
  type StoryboardRequest,
  storyboardVideoShotLimit,
  type VariationPlan,
  variationCapabilitiesSchema,
  variationPlanSchema,
  videoUnitCredits,
  walletBalanceSchema,
} from "@lycoboai/contracts";
import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useErrorToast } from "../../../lib/error-toast";
import { enterpriseSessionKey, useEnterpriseSession } from "../../auth/auth-client";
import {
  ImageApiError,
  imageRequest,
  pendingSubmissionSource,
  uploadImageReferences,
  useGenerateImage,
  useImageModels,
  usePendingSubmission,
} from "../../generation/generation-client";
import { modelCapabilities, supportsReferences } from "../../generation/models/model-capabilities";
import type { ReferenceImage } from "../../generation/studio-state";
import { useSubmitVideo } from "../video-client";
import { emptyStoryboard, originalReference, useStoryboardState } from "./storyboard-state";

const source = "tk-storyboard";
const modelId = "gpt-image-2.5";
const resolution = "1.5K";
const isRunning = (status: string) => status === "queued" || status === "running";
const definitive = (error: unknown) =>
  error instanceof ImageApiError && [400, 401, 403, 409, 413, 429].includes(error.status);
export const automaticVideoCost = emptyStoryboard.count * imageUnitCredits + videoUnitCredits;

export function useStoryboard(enabled: boolean, showHistory: () => void) {
  const owner = useEnterpriseSession().data ?? undefined;
  const scope = owner ? `${owner.organizationId}:${owner.userId}` : "";
  const draft = useStoryboardState((state) => state.drafts[scope]) ?? emptyStoryboard;
  const { progress } = draft;
  const client = useQueryClient();
  const generation = useGenerateImage(enabled);
  const models = useImageModels(enabled);
  const video = useSubmitVideo("storyboard");
  const pendingImage = usePendingSubmission(owner);
  let ownImagePending = false;
  if (enabled && owner && pendingImage) {
    try {
      ownImagePending = pendingSubmissionSource(owner) === source;
    } catch {
      // A damaged confirmation record still blocks new paid submissions.
    }
  }
  const lock = useRef(false);
  const mutationKey = ["tk-storyboard-action", scope];
  const active = useIsMutating({ mutationKey }) > 0;
  useEffect(() => {
    if (enabled) useStoryboardState.getState().load(scope);
  }, [enabled, scope]);
  const capabilities = useQuery({
    queryKey: ["tk-storyboard-capabilities", scope],
    enabled: enabled && !!scope,
    retry: false,
    queryFn: async ({ signal }) =>
      variationCapabilitiesSchema.parse(
        await (await imageRequest("video-storyboards/capabilities", { signal })).json(),
      ),
  });
  const model = modelCapabilities(models.data, modelId, "create");
  const configured =
    capabilities.data?.enabled === true &&
    model?.enabledResolutions.includes(resolution) === true &&
    supportsReferences(model, 1);
  const current = () => useStoryboardState.getState().drafts[scope] ?? emptyStoryboard;
  const update = (patch: Partial<typeof draft>) =>
    useStoryboardState.getState().update(scope, patch);
  const save = (patch: Partial<typeof progress>) =>
    update({ progress: { ...current().progress, ...patch } });

  function assertOwner() {
    const identity = client.getQueryData<typeof owner>(enterpriseSessionKey);
    if (
      !identity ||
      identity.organizationId !== owner?.organizationId ||
      identity.userId !== owner.userId
    )
      throw new Error("登录身份已变化，请回到原账号继续制作");
  }

  async function planRequest(attempt: { key: string; input: StoryboardRequest }) {
    assertOwner();
    const response = await imageRequest(
      "video-storyboards",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": attempt.key },
        body: JSON.stringify(attempt.input),
      },
      90_000,
    );
    return variationPlanSchema.parse(await response.json());
  }

  async function waitForImages(id: string) {
    const deadline = Date.now() + 8 * 60_000;
    while (Date.now() < deadline) {
      assertOwner();
      const job = imageJobSchema.parse(await (await imageRequest(`image-tasks/${id}`)).json());
      if (!isRunning(job.status)) return job;
      await new Promise((resolve) => setTimeout(resolve, 4000));
    }
    throw new Error("画面仍在制作，请稍后点击继续生成");
  }

  function finish(id: string) {
    update({ progress: { acceptedVideoId: id } });
  }

  const action = useMutation({
    mutationKey,
    retry: false,
    mutationFn: async (input: { description: string; references: ReferenceImage[] }) => {
      if (!owner) throw new Error("请先登录");
      assertOwner();
      if (video.hasPending) {
        const result = await video.submitAsync({
          input: { prompt: "", seconds: draft.seconds, aspectRatio: "9:16" },
          references: [],
          clearDraft: false,
        });
        finish(result.id);
        return;
      }
      const resuming = !!(progress.planAttempt || progress.planId || progress.batchId);
      if (!resuming) {
        if (!configured || pendingImage)
          throw new Error("暂时无法制作视频，请检查生成服务和待确认任务");
        update({ ...emptyStoryboard, ...input });
        const balance = walletBalanceSchema.parse(await (await imageRequest("wallet")).json());
        if (balance.balance < automaticVideoCost)
          throw new Error(`本次预计需要 ${automaticVideoCost} 积分，请补充积分后再试`);
      }
      let snapshot: VariationPlan;
      const planId = current().progress.planId;
      if (planId) {
        snapshot = variationPlanSchema.parse(
          await (await imageRequest(`variation-plans/${planId}`)).json(),
        );
      } else {
        let attempt = current().progress.planAttempt;
        if (!attempt) {
          assertOwner();
          const [originalAssetId] = await uploadImageReferences(
            client,
            owner,
            current().references,
          );
          if (!originalAssetId) throw new Error("请上传商品图片");
          attempt = {
            key: crypto.randomUUID(),
            input: {
              stage: "plan",
              description: current().description.trim(),
              originalAssetId,
              count: current().count,
              seconds: current().seconds,
            },
          };
          update({ references: [originalReference(originalAssetId)] });
          save({ planAttempt: attempt });
        }
        try {
          snapshot = await planRequest(attempt);
        } catch (error) {
          if (definitive(error)) save({ planAttempt: undefined });
          throw error;
        }
        if (snapshot.status === "running") throw new Error("正在准备画面，请稍后继续");
        if (snapshot.status !== "ready" || !snapshot.items.length) {
          save({ planAttempt: undefined });
          throw new Error("画面方案未完成，请稍后重试");
        }
        save({ planId: snapshot.id, planAttempt: undefined });
      }
      const originalAssetId = snapshot.referenceAssetIds[0];
      if (snapshot.status !== "ready" || !originalAssetId) throw new Error("画面资料不完整");
      let batchId = current().progress.batchId;
      if (!batchId || ownImagePending) {
        assertOwner();
        if (!ownImagePending && !configured) throw new Error("画面生成服务暂时不可用");
        const target = ownImagePending ? current().progress.imageTarget : "batch";
        const items =
          target === "batch" || !target
            ? snapshot.items
            : snapshot.items.filter(({ id }) => id === target);
        save({ imageTarget: target ?? "batch" });
        const batch = await generation.mutateAsync({
          model: modelId,
          source,
          draft: {
            prompt: current().description.slice(0, 600),
            references: [originalReference(originalAssetId)],
            ratio: "9:16",
            resolution,
            count: String(items.length),
            quality: "标准",
          },
          variation: { version: 1, planId: snapshot.id, items },
        });
        batchId ??= batch.id;
        save({ batchId, imageTarget: undefined });
      }
      const job = await waitForImages(batchId);
      void client.invalidateQueries({ queryKey: ["wallet"] });
      void client.invalidateQueries({ queryKey: ["wallet-entries"] });
      void client.invalidateQueries({ queryKey: ["image-assets"] });
      const seen = new Set([originalAssetId]);
      const shots = [...job.items]
        .sort((a, b) => a.position - b.position)
        .flatMap((item) => {
          const plan = snapshot.items[item.position];
          if (
            !plan ||
            item.status !== "succeeded" ||
            !item.output_asset_id ||
            seen.has(item.output_asset_id)
          )
            return [];
          seen.add(item.output_asset_id);
          return [
            { assetId: item.output_asset_id, title: plan.title, prompt: plan.prompt.slice(0, 250) },
          ];
        })
        .slice(0, storyboardVideoShotLimit);
      if (!shots.length) {
        if (job.status === "failed") update({ progress: {} });
        throw new Error("画面未生成，视频任务尚未提交");
      }
      const optimization: StoryboardRequest = {
        stage: "video",
        description: current().description,
        originalAssetId,
        seconds: current().seconds,
        shots,
      };
      const prior = current().progress.optimization;
      const attempt =
        prior && JSON.stringify(prior.input) === JSON.stringify(optimization)
          ? prior
          : { key: crypto.randomUUID(), input: optimization, prompt: undefined };
      save({ optimization: attempt });
      let prompt = attempt.prompt;
      if (!prompt) {
        let optimized: VariationPlan;
        try {
          optimized = await planRequest(attempt);
        } catch (error) {
          if (definitive(error)) save({ optimization: undefined });
          throw error;
        }
        if (optimized.status === "running") throw new Error("正在编写视频提示词，请稍后继续");
        prompt = optimized.status === "ready" ? optimized.items[0]?.prompt : undefined;
        if (!prompt) {
          save({ optimization: undefined });
          throw new Error("视频提示词未完成，请稍后继续");
        }
        save({ optimization: { ...attempt, prompt } });
      }
      assertOwner();
      const result = await video.submitAsync({
        input: { prompt, seconds: optimization.seconds, aspectRatio: "9:16" },
        references: [originalAssetId, ...shots.map(({ assetId }) => assetId)].map(
          originalReference,
        ),
        clearDraft: false,
      });
      finish(result.id);
    },
    onSettled: () => {
      lock.current = false;
    },
  });
  useErrorToast(action.error?.message);
  return {
    draft,
    configured,
    unavailable:
      capabilities.isError ||
      models.isError ||
      (capabilities.isSuccess && models.isSuccess && !configured),
    scope,
    busy: active || action.isPending,
    needsResume:
      video.hasPending ||
      ownImagePending ||
      !!(progress.planAttempt || progress.planId || progress.batchId),
    remainingCost:
      progress.batchId || video.hasPending
        ? videoUnitCredits
        : draft.count * imageUnitCredits + videoUnitCredits,
    pendingVideo: video.hasPending,
    blocked:
      (pendingImage && !ownImagePending) ||
      video.blockedByPending ||
      video.isPending ||
      generation.isPending,
    failed: action.isError,
    start: (input: Parameters<typeof action.mutate>[0]) => {
      if (lock.current || active || !scope) return;
      lock.current = true;
      showHistory();
      action.mutate(input);
    },
  };
}
