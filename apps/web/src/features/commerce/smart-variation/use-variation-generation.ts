import { imageUnitCredits } from "@lycoboai/contracts";
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
import { useSmartVariationDraft } from "./smart-variation-state";

/** 套图计划确认后的批量生成：每条方案提交一张图，提交前校验登录、模型与参考图。 */
export function useVariationGeneration() {
  const draft = useSmartVariationDraft();
  const session = useImageSession();
  const models = useImageModels();
  const generation = useGenerateImage();
  const pending = usePendingSubmission(session.data);
  const ownPending =
    pending && !!session.data && pendingSubmissionSource(session.data) === "smart-variation";
  const selected = draft.items.filter((item) => item.selected);
  const caps = modelCapabilities(models.data, "gpt-image-2.5", "create");
  const configured =
    !!caps?.enabledResolutions.some((value) => value === draft.resolution) &&
    (!draft.references.length || supportsReferences(caps, draft.references.length));
  useErrorToast(generation.error?.message);
  return {
    submitting: generation.isPending,
    pending: ownPending,
    count: selected.length,
    cost: selected.length * imageUnitCredits,
    canGenerate:
      session.isSuccess &&
      !generation.isPending &&
      (ownPending ||
        (!pending &&
          configured &&
          !!draft.planId &&
          selected.length > 0 &&
          selected.every((item) => item.title.trim() && item.prompt.trim().length >= 5))),
    async submit() {
      if (!draft.planId && !ownPending) return;
      revealNewestHistory();
      await generation.mutateAsync({
        model: "gpt-image-2.5",
        source: "smart-variation",
        draft: {
          references: draft.references,
          prompt: draft.description,
          ratio: draft.ratio,
          resolution: draft.resolution,
          count: String(selected.length),
          quality: "medium",
        },
        ...(draft.planId
          ? {
              variation: {
                version: 1,
                planId: draft.planId,
                items: selected.map(({ selected: _selected, ...item }) => item),
              },
            }
          : {}),
      });
      const current = useSmartVariationDraft.getState();
      if (current.items === draft.items && current.description === draft.description)
        current.update({ description: "", references: [], items: [], planId: null });
    },
  };
}
