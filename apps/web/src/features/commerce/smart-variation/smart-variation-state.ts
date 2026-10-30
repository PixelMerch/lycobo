import { create } from "zustand";
import type { ReferenceImage } from "../../generation/studio-state";

export type VariationPlanItem = { id: string; title: string; prompt: string; selected: boolean };
type Draft = {
  references: ReferenceImage[];
  description: string;
  model: string;
  ratio: string;
  resolution: string;
  items: VariationPlanItem[];
  planId: string | null;
};
/** Session-only editing draft. Server plan and generation task remain durable. */
export const useSmartVariationDraft = create<Draft & { update: (patch: Partial<Draft>) => void }>(
  (set) => ({
    references: [],
    description: "",
    model: "",
    ratio: "1:1",
    resolution: "1.5K",
    items: [],
    planId: null,
    update: (patch) =>
      set((state) => ({
        ...patch,
        ...(!("planId" in patch) &&
        ((patch.description !== undefined && patch.description !== state.description) ||
          (patch.references !== undefined && patch.references !== state.references))
          ? { planId: null, items: [] }
          : {}),
      })),
  }),
);
