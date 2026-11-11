import {
  imageJobSchema,
  imageUnitCredits,
  type StoryboardRequest,
  type VariationPlan,
  variationPlanSchema,
  videoUnitCredits,
  walletBalanceSchema,
} from "@lycoboai/contracts";
import type { QueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import type { RefObject } from "react";
import { currentMessages } from "../../../i18n/messages";
import { enterpriseSessionKey, type useEnterpriseSession } from "../../auth/auth-client";
import { imageRequest, type useGenerateImage } from "../../generation/generation-client";
import type { ReferenceImage } from "../../generation/studio-state";
import type { useSubmitVideo, useVideoModel } from "../video-client";
import { videoMessages } from "../video-messages";
import { clearSubmittedVideoDraft } from "../video-state";
import {
  hasStarted,
  prepareStoryboardPlan,
  prepareVideoPrompt,
  submitStoryboardFrames,
  waitForImages,
} from "./storyboard-stages";
import { emptyStoryboard, originalReference, useStoryboardState } from "./storyboard-state";

export type ProductionInput = {
  description: string;
  references: ReferenceImage[];
  retryPosition?: number;
};

type Draft = typeof emptyStoryboard;
type Owner = NonNullable<ReturnType<typeof useEnterpriseSession>["data"]>;
const automaticCost = emptyStoryboard.count * imageUnitCredits + videoUnitCredits;

/** 分镜制作的执行环境：读写草稿、校验账号与保存进度。 */
export function storyboardExecutionContext(
  scope: string,
  owner: Owner | undefined,
  client: QueryClient,
) {
  const current = () => useStoryboardState.getState().drafts[scope] ?? emptyStoryboard;
  const update = (patch: Partial<typeof emptyStoryboard>) =>
    useStoryboardState.getState().update(scope, patch);
  const save = (patch: Partial<typeof emptyStoryboard.progress>) =>
    update({ progress: { ...current().progress, ...patch } });

  function assertOwner() {
    const identity = client.getQueryData<typeof owner>(enterpriseSessionKey);
    if (
      !identity ||
      identity.organizationId !== owner?.organizationId ||
      identity.userId !== owner.userId
    )
      throw new Error(currentMessages(videoMessages).accountChanged);
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

  async function readImageJob(id: string) {
    assertOwner();
    return imageJobSchema.parse(await (await imageRequest(`image-tasks/${id}`)).json());
  }

  function finish(id: string) {
    const { progress } = current();
    // 描述和图片保留到下一次制作，历史列表返回新任务前制作卡仍有内容。
    update({
      submittedDraft: undefined,
      progress: { acceptedVideoId: id, frames: progress.frames },
    });
  }

  return { client, current, update, save, assertOwner, planRequest, readImageJob, finish };
}

async function assertCanStart(
  draft: Draft,
  referenceImagesBlocked: boolean,
  configured: boolean,
  pendingImage: boolean,
  referenceCount: number,
  maxOriginalImages: number,
) {
  if (hasStarted(draft.progress)) return;
  if (referenceImagesBlocked) throw new Error(currentMessages(videoMessages).referencesUnavailable);
  if (!configured || pendingImage || referenceCount > maxOriginalImages)
    throw new Error(currentMessages(videoMessages).cannotProduce);
  const balance = walletBalanceSchema.parse(await (await imageRequest("wallet")).json());
  if (balance.balance < automaticCost)
    throw new Error(currentMessages(videoMessages).needCredits(automaticCost));
}

function storyboardOriginals(snapshot: VariationPlan, count: number): [string, ...string[]] {
  const [originalAssetId, ...additionalOriginalAssetIds] = snapshot.referenceAssetIds;
  if (snapshot.status !== "ready" || !originalAssetId || snapshot.items.length !== count)
    throw new Error(currentMessages(videoMessages).frameDataIncomplete);
  return [originalAssetId, ...additionalOriginalAssetIds];
}

function handOffSubmittedDraft(draft: Draft, update: (patch: Partial<Draft>) => void) {
  const { submittedDraft } = draft;
  if (submittedDraft) {
    clearSubmittedVideoDraft(submittedDraft);
    update({ submittedDraft: undefined });
  }
}

/** 分镜制作的执行：依次准备画面、生成分镜、编写提示词并提交视频。 */
export function useStoryboardAction({
  mutationKey,
  lock,
  owner,
  execution,
  video,
  videoModel,
  generation,
  draft,
  pendingImage,
  ownImagePending,
  incompleteVideoPending,
  configured,
  maxOriginalImages,
  showPanel,
}: {
  mutationKey: string[];
  lock: RefObject<boolean>;
  owner: Owner | undefined;
  execution: ReturnType<typeof storyboardExecutionContext>;
  video: ReturnType<typeof useSubmitVideo>;
  videoModel: ReturnType<typeof useVideoModel>;
  generation: ReturnType<typeof useGenerateImage>;
  draft: Draft;
  pendingImage: boolean;
  ownImagePending: boolean;
  incompleteVideoPending: boolean;
  configured: boolean;
  maxOriginalImages: number;
  showPanel: (panel: "form" | "history") => void;
}) {
  const { client, current, update, save, assertOwner, planRequest, readImageJob, finish } =
    execution;
  const referenceImagesBlocked = videoModel.data?.referenceImagesEnabled === false;
  return useMutation({
    mutationKey,
    retry: false,
    mutationFn: async (input: ProductionInput) => {
      if (!owner) throw new Error(currentMessages(videoMessages).signInFirst);
      assertOwner();
      if (video.hasPending && !incompleteVideoPending) {
        if (referenceImagesBlocked)
          throw new Error(currentMessages(videoMessages).referencesUnavailable);
        const result = await video.submitAsync({
          input: { prompt: "", seconds: draft.seconds, aspectRatio: "9:16" },
          references: [],
          clearDraft: false,
        });
        finish(result.id);
        return;
      }
      await assertCanStart(
        draft,
        referenceImagesBlocked,
        configured,
        pendingImage,
        input.references.length,
        maxOriginalImages,
      );
      const snapshot = await prepareStoryboardPlan({
        current,
        update,
        save,
        assertOwner,
        planRequest,
        client,
        owner,
      });
      const [originalAssetId, ...additionalOriginalAssetIds] = storyboardOriginals(
        snapshot,
        current().count,
      );
      const originalAssetIds = [originalAssetId, ...additionalOriginalAssetIds];
      const batchId = await submitStoryboardFrames({
        current,
        save,
        assertOwner,
        readImageJob,
        generation,
        configured,
        ownImagePending,
        snapshot,
        originalAssetIds,
        retryPosition: input.retryPosition,
      });
      handOffSubmittedDraft(current(), update);
      const completed = await waitForImages(
        batchId,
        snapshot,
        originalAssetIds,
        readImageJob,
        current,
        save,
      );
      void client.invalidateQueries({ queryKey: ["wallet"] });
      void client.invalidateQueries({ queryKey: ["wallet-entries"] });
      void client.invalidateQueries({ queryKey: ["image-assets"] });
      const shots = completed.map(({ assetId, title, prompt }) => ({ assetId, title, prompt }));
      if (shots.length !== current().count) return;
      const { prompt, optimization } = await prepareVideoPrompt({
        current,
        save,
        planRequest,
        originalAssetId,
        additionalOriginalAssetIds,
        shots,
      });
      assertOwner();
      if (referenceImagesBlocked)
        throw new Error(currentMessages(videoMessages).referencesUnavailable);
      const result = await video.submitAsync({
        input: {
          prompt,
          seconds: optimization.seconds,
          aspectRatio: "9:16",
          storyboard: { description: optimization.description },
          ...(originalAssetIds.length > 1
            ? { storyboardOriginalImageCount: originalAssetIds.length }
            : {}),
        },
        references: [...originalAssetIds, ...shots.map(({ assetId }) => assetId)].map(
          originalReference,
        ),
        clearDraft: false,
        repairPending: incompleteVideoPending,
      });
      finish(result.id);
    },
    onError: () => {
      // 还没有任何持久化内容，草稿仍在表单里，回到表单。
      if (!hasStarted(current().progress)) showPanel("form");
    },
    onSettled: () => {
      lock.current = false;
    },
  });
}
