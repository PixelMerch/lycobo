import { useErrorToast } from "../../../lib/error-toast";
import {
  pendingSubmissionSource,
  useGenerateImage,
  useImageModels,
  useImageSession,
  usePendingSubmission,
} from "../../generation/generation-client";
import type { Draft } from "../../generation/studio-state";
import { useTextileSetDraft } from "./textile-set-state";

export function useTextileGeneration() {
  const draft = useTextileSetDraft();
  const session = useImageSession();
  const models = useImageModels();
  const generation = useGenerateImage();
  const pending = usePendingSubmission(session.data);
  const ownPending =
    pending && !!session.data && pendingSubmissionSource(session.data) === "textile-set";
  const resolutions =
    models.data?.models.find((model) => model.id === "gpt-image-2")?.enabledResolutions ?? [];
  const configured =
    !!models.data?.enabled && !!models.data.editsEnabled && resolutions.includes(draft.resolution);
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
        prompt: "家纺主图裂变",
        ratio: draft.ratio,
        resolution: draft.resolution,
        quality: "标准",
        count: String(draft.views.length),
        references,
      };
      generation.mutate(
        {
          model: "gpt-image-2",
          draft: input,
          source: "textile-set",
          textileSet: { version: 4, views: draft.views },
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
