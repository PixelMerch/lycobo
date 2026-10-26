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
  const configured =
    !!models.data?.enabled &&
    !!models.data.editsEnabled &&
    !!models.data.models
      .find((model) => model.id === "gpt-image-2.5")
      ?.enabledResolutions.includes("1K");
  useErrorToast(generation.error?.message ?? models.error?.message);
  return {
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
        resolution: "1K",
        quality: "标准",
        count: String(draft.views.length),
        references,
      };
      generation.mutate({
        model: "gpt-image-2.5",
        draft: input,
        source: "textile-set",
        textileSet: { version: 2, views: draft.views },
      });
    },
  };
}
