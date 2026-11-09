import { useErrorToast } from "../../../lib/error-toast";
import {
  pendingSubmissionSource,
  useGenerateImage,
  useImageModels,
  useImageSession,
  usePendingSubmission,
} from "../../generation/generation-client";
import { revealNewestHistory } from "../../generation/history/history-navigation";
import { modelCapabilities, supportsReferences } from "../../generation/models/model-capabilities";
import type { Draft } from "../../generation/studio-state";
import { useTextileSetDraft } from "./textile-set-state";

/**
 * 家纺裂变任务固定提交的提示词标记：服务端按所选视角生成，不读这段文字，只把它存为任务提示词。
 * 不随界面语言变化；显示时换成当前语言的工具名称。
 */
export const textilePromptMarker = "家纺裂变";

/** 家纺裂变的生成：按选中的视角提交整套图片，提交前校验登录、模型与主图。 */
export function useTextileGeneration() {
  const draft = useTextileSetDraft();
  const session = useImageSession();
  const models = useImageModels();
  const generation = useGenerateImage();
  const pending = usePendingSubmission(session.data);
  const ownPending =
    pending && !!session.data && pendingSubmissionSource(session.data) === "textile-set";
  const capabilities = modelCapabilities(models.data, "gpt-image-2.5", "textile-set");
  const resolutions = capabilities?.enabledResolutions ?? [];
  const configured =
    supportsReferences(capabilities, 1 + draft.detailImages.length) &&
    resolutions.includes(draft.resolution);
  useErrorToast(generation.error?.message ?? models.error?.message);
  return {
    resolutions,
    pending: ownPending,
    submitting: generation.isPending,
    canGenerate:
      session.isSuccess &&
      !generation.isPending &&
      (ownPending || (!pending && configured && !!draft.mainImage && draft.views.length > 0)),
    unavailable: session.isSuccess && models.isSuccess && !configured,
    submit: () => {
      const references = [draft.mainImage, ...draft.detailImages].filter((image) => image !== null);
      const input: Draft = {
        prompt: textilePromptMarker,
        ratio: draft.ratio,
        resolution: draft.resolution,
        quality: "medium",
        count: String(draft.views.length),
        references,
      };
      revealNewestHistory();
      generation.mutate(
        {
          model: "gpt-image-2.5",
          draft: input,
          source: "textile-set",
          textileSet: { version: 5, views: draft.views },
        },
        {
          onSuccess: () => {
            if (ownPending) return;
            const current = useTextileSetDraft.getState();
            current.update({
              ...(current.mainImage === draft.mainImage ? { mainImage: null } : {}),
              ...(current.detailImages === draft.detailImages ? { detailImages: [] } : {}),
              ...(current.views === draft.views ? { views: [] } : {}),
            });
          },
        },
      );
    },
  };
}
