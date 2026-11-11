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
import {
  submissionReferenceRoles,
  useReferenceRoles,
} from "../../generation/references/reference-roles";
import { itemReferenceIndexes, usePlanBindings } from "./plan-image-bindings";
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
  // 标了原图时，每条方案至少要用到一张图，避免不小心把一条方案变成不带参考图的生成。
  const roles = useReferenceRoles((state) => state.roles);
  const bindings = usePlanBindings((state) => state.bindings);
  const itemReferences = itemReferenceIndexes(selected, draft.references, roles, bindings);
  const everyItemHasImages =
    !itemReferences || selected.every((item) => (itemReferences[item.id]?.length ?? 0) > 0);
  const caps = modelCapabilities(models.data, "gpt-image-2.6", "create");
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
          everyItemHasImages &&
          selected.every((item) => item.title.trim() && item.prompt.trim().length >= 5))),
    async submit() {
      if (!draft.planId && !ownPending) return;
      revealNewestHistory();
      await generation.mutateAsync({
        model: "gpt-image-2.6",
        source: "smart-variation",
        draft: {
          references: draft.references,
          prompt: draft.description,
          ratio: draft.ratio,
          resolution: draft.resolution,
          count: String(selected.length),
          quality: "medium",
        },
        referenceRoles: submissionReferenceRoles(draft.references),
        itemReferences,
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
