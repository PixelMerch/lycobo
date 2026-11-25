import { toast } from "@heroui/react";
import {
  imageUnitCredits,
  storyboardCapabilitiesSchema,
  videoUnitCredits,
} from "@lycoboai/contracts";
import { useIsMutating, useQuery, useQueryClient } from "@tanstack/react-query";
import { type RefObject, useEffect, useRef } from "react";
import { currentMessages } from "../../../i18n/messages";
import { useErrorToast } from "../../../lib/error-toast";
import { useEnterpriseSession } from "../../auth/auth-client";
import {
  imageRequest,
  pendingSubmissionSource,
  useGenerateImage,
  useImageModels,
  usePendingSubmission,
} from "../../generation/generation-client";
import { modelCapabilities, supportsReferences } from "../../generation/models/model-capabilities";
import { useSubmitVideo, useVideoModel } from "../video-client";
import { videoMessages } from "../video-messages";
import { restoreVideoDraft, useVideoDraft } from "../video-state";
import { hasStarted, isRunning, modelId, resolution, source } from "./storyboard-stages";
import { emptyStoryboard, useStoryboardState } from "./storyboard-state";
import {
  type ProductionInput,
  storyboardExecutionContext,
  useStoryboardAction,
} from "./use-storyboard-action";

export const automaticVideoCost = emptyStoryboard.count * imageUnitCredits + videoUnitCredits;

/** 恢复分镜草稿并管理首帧和视频生成任务的进度。 */
export function useStoryboard(enabled: boolean, showPanel: (panel: "form" | "history") => void) {
  const owner = useEnterpriseSession().data ?? undefined;
  const scope = owner ? `${owner.organizationId}:${owner.userId}` : "";
  const draft = useStoryboardState((state) => state.drafts[scope]) ?? emptyStoryboard;
  const { progress } = draft;
  const client = useQueryClient();
  const generation = useGenerateImage({ enabled });
  const models = useImageModels(enabled);
  const videoModel = useVideoModel(enabled);
  const video = useSubmitVideo("storyboard");
  const pendingImage = usePendingSubmission(owner);
  const ownImagePending = isOwnStoryboardSubmission(enabled, owner, pendingImage);
  const lock = useRef(false);
  const mutationKey = ["tk-storyboard-action", scope];
  const active = useIsMutating({ mutationKey }) > 0;
  useEffect(() => {
    if (enabled) useStoryboardState.getState().load(scope);
  }, [enabled, scope]);
  const capabilities = useStoryboardCapabilities(enabled, scope);
  const limits = storyboardLimits(capabilities, models, videoModel);
  const { configured, maxOriginalImages, unavailable } = limits;
  const frames = storyboardFrameState(draft, ownImagePending, video.pendingReferenceCount);
  const {
    framesIncomplete,
    waitingForFrames,
    resumingFrames,
    checkingFrames,
    incompleteVideoPending,
  } = frames;
  const blocked = hasBlockingSubmission(pendingImage, ownImagePending, video, generation);
  const needsResume = video.hasPending || ownImagePending || hasStarted(progress);
  const execution = storyboardExecutionContext(scope, owner, client);
  const { current, update } = execution;

  const action = useStoryboardAction({
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
  });
  const controls = useStoryboardControls({
    action,
    enabled,
    referenceImagesBlocked: videoModel.data?.referenceImagesEnabled === false,
    needsResume,
    resumingFrames,
    waitingForFrames,
    active,
    progress,
    pendingVideo: video.hasPending,
    ownImagePending,
    lock,
    blocked,
    scope,
    showPanel,
    current,
    update,
    draft,
  });
  return {
    draft,
    configured,
    maxOriginalImages,
    unavailable,
    scope,
    needsResume,
    /** 任务已保存独立快照，表单可以编辑下一份草稿。 */
    handedOff: !!progress.batchId,
    remainingCost:
      progress.batchId || video.hasPending
        ? videoUnitCredits
        : draft.count * imageUnitCredits + videoUnitCredits,
    pendingVideo: video.hasPending,
    blocked,
    waitingForFrames,
    resumingFrames,
    checkingFrames,
    canRetryFrame: canRetryStoryboardFrame(blocked, ownImagePending, framesIncomplete),
    ...controls,
  };
}

type Owner = NonNullable<ReturnType<typeof useEnterpriseSession>["data"]>;
type Draft = typeof emptyStoryboard;
type Progress = Draft["progress"];

function useStoryboardCapabilities(enabled: boolean, scope: string) {
  return useQuery({
    queryKey: ["tk-storyboard-capabilities", scope],
    enabled: enabled && !!scope,
    retry: false,
    queryFn: async ({ signal }) =>
      storyboardCapabilitiesSchema.parse(
        await (await imageRequest("video-storyboards/capabilities", { signal })).json(),
      ),
  });
}

function isOwnStoryboardSubmission(
  enabled: boolean,
  owner: Owner | undefined,
  pendingImage: boolean,
) {
  let ownImagePending = false;
  if (enabled && owner && pendingImage) {
    try {
      ownImagePending = pendingSubmissionSource(owner) === source;
    } catch {
      // A damaged confirmation record still blocks new paid submissions.
    }
  }
  return ownImagePending;
}

function storyboardLimits(
  capabilities: ReturnType<typeof useStoryboardCapabilities>,
  models: ReturnType<typeof useImageModels>,
  videoModel: ReturnType<typeof useVideoModel>,
) {
  const model = modelCapabilities(models.data, modelId, "create");
  const maxOriginalImages = Math.min(
    capabilities.data?.maxStoryboardOriginalImages ?? 1,
    videoModel.data?.maxStoryboardOriginalImages ?? 1,
    model?.maxReferences ?? 1,
  );
  const configured =
    capabilities.data?.enabled === true &&
    model?.enabledResolutions.includes(resolution) === true &&
    supportsReferences(model, 1);
  const unavailable =
    capabilities.isError ||
    models.isError ||
    (capabilities.isSuccess && models.isSuccess && !configured);
  return { configured, maxOriginalImages, unavailable };
}

function storyboardFrameState(
  draft: Draft,
  ownImagePending: boolean,
  pendingReferenceCount: number | undefined,
) {
  const { progress } = draft;
  const framesIncomplete =
    !!progress.batchId &&
    !!progress.frameJobStatus &&
    !isRunning(progress.frameJobStatus) &&
    (progress.frames?.length ?? 0) !== draft.count;
  const waitingForFrames = framesIncomplete && !ownImagePending;
  const resumingFrames =
    ownImagePending ||
    (!!progress.batchId && !progress.frameJobStatus) ||
    isRunning(progress.frameJobStatus ?? "");
  const checkingFrames =
    waitingForFrames &&
    (progress.failedFramePositions?.length === 0 ||
      (progress.failedFramePositions === undefined &&
        progress.frameJobStatus !== "failed" &&
        progress.frameJobStatus !== "partially_failed"));
  const incompleteVideoPending =
    !!progress.batchId &&
    pendingReferenceCount !== undefined &&
    pendingReferenceCount < draft.references.length + draft.count;
  return {
    framesIncomplete,
    waitingForFrames,
    resumingFrames,
    checkingFrames,
    incompleteVideoPending,
  };
}

function hasBlockingSubmission(
  pendingImage: boolean,
  ownImagePending: boolean,
  video: ReturnType<typeof useSubmitVideo>,
  generation: ReturnType<typeof useGenerateImage>,
) {
  return (
    (pendingImage && !ownImagePending) ||
    video.blockedByPending ||
    video.isPending ||
    generation.isPending
  );
}

function canRetryStoryboardFrame(
  blocked: boolean,
  ownImagePending: boolean,
  framesIncomplete: boolean,
) {
  return !blocked && !ownImagePending && framesIncomplete;
}

function useStoryboardControls({
  action,
  enabled,
  referenceImagesBlocked,
  needsResume,
  resumingFrames,
  waitingForFrames,
  active,
  progress,
  pendingVideo,
  ownImagePending,
  lock,
  blocked,
  scope,
  showPanel,
  current,
  update,
  draft,
}: {
  action: ReturnType<typeof useStoryboardAction>;
  enabled: boolean;
  referenceImagesBlocked: boolean;
  needsResume: boolean;
  resumingFrames: boolean;
  waitingForFrames: boolean;
  active: boolean;
  progress: Progress;
  pendingVideo: boolean;
  ownImagePending: boolean;
  lock: RefObject<boolean>;
  blocked: boolean;
  scope: string;
  showPanel: (panel: "form" | "history") => void;
  current: () => Draft;
  update: (patch: Partial<Draft>) => void;
  draft: Draft;
}) {
  const resumeBlockedByReferences =
    referenceImagesBlocked && needsResume && !resumingFrames && !waitingForFrames;
  useErrorToast(
    enabled
      ? (action.error?.message ??
          (resumeBlockedByReferences
            ? currentMessages(videoMessages).referencesUnavailable
            : undefined))
      : undefined,
  );
  const busy = active || action.isPending;
  // 结果不明的提交可能已经扣费，必须确认，不能直接放弃。
  const canAbandon = !busy && hasStarted(progress) && !pendingVideo && !ownImagePending;
  const canRun = () => !lock.current && !active && !blocked && !!scope;
  const run = (input: ProductionInput) => {
    if (!canRun()) return;
    lock.current = true;
    showPanel("history");
    action.mutate(input);
  };
  return {
    busy,
    canAbandon,
    abandon: () => {
      if (!canAbandon) return;
      const { description, references } = current();
      restoreVideoDraft(description, references);
      update({ ...emptyStoryboard, startedAt: undefined, submittedDraft: undefined });
      action.reset();
    },
    start: (input: Omit<ProductionInput, "retryPosition">) => {
      if (needsResume || !canRun()) return;
      // 请求前先保存，新的制作卡不会显示上一次的内容。
      update({
        ...emptyStoryboard,
        ...input,
        startedAt: new Date().toISOString(),
        submittedDraft: useVideoDraft.getState(),
      });
      run(input);
    },
    resume: () => {
      if (resumeBlockedByReferences) {
        toast.danger(currentMessages(videoMessages).referencesUnavailable);
        return;
      }
      run({ description: draft.description, references: draft.references });
    },
    retryFrame: (retryPosition: number) =>
      run({ description: draft.description, references: draft.references, retryPosition }),
  };
}
