import { type StoryboardProgress, storedStoryboardSchema } from "@lycoboai/contracts";
import { create } from "zustand";
import type { ReferenceImage } from "../../generation/studio-state";

type Draft = {
  description: string;
  references: ReferenceImage[];
  count: number;
  seconds: number;
  showPanel: boolean;
  progress: StoryboardProgress;
};
const emptyProgress = (): StoryboardProgress => ({ order: [], excluded: [], replacements: {} });
export const emptyStoryboard: Draft = {
  description: "",
  references: [],
  count: 3,
  seconds: 10,
  showPanel: true,
  progress: emptyProgress(),
};
const key = (scope: string) => `lycobo-tk-storyboard:${scope}`;
export const originalReference = (assetId: string): ReferenceImage => ({
  id: assetId,
  assetId,
  name: "商品原图",
  src: `/api/v1/image-assets/${assetId}/content`,
});

export const useStoryboardState = create<{
  drafts: Record<string, Draft>;
  load: (scope: string) => void;
  update: (scope: string, patch: Partial<Draft>) => void;
  reset: (scope: string) => void;
}>((set, get) => ({
  drafts: {},
  load(scope) {
    if (!scope || get().drafts[scope]) return;
    let draft = emptyStoryboard;
    try {
      const parsed = storedStoryboardSchema.safeParse(
        JSON.parse(sessionStorage.getItem(key(scope)) ?? "null"),
      );
      if (parsed.success) {
        const { originalAssetId, ...rest } = parsed.data;
        draft = {
          ...rest,
          references: originalAssetId ? [originalReference(originalAssetId)] : [],
        };
      }
    } catch {
      // Browser storage may be disabled.
    }
    set((state) => ({ drafts: { ...state.drafts, [scope]: draft } }));
  },
  update(scope, patch) {
    const next = { ...(get().drafts[scope] ?? emptyStoryboard), ...patch };
    set((state) => ({ drafts: { ...state.drafts, [scope]: next } }));
    try {
      sessionStorage.setItem(
        key(scope),
        JSON.stringify({
          description: next.description,
          count: next.count,
          seconds: next.seconds,
          showPanel: next.showPanel,
          originalAssetId: next.references[0]?.assetId,
          progress: next.progress,
        }),
      );
    } catch {
      // The current workspace still retains its draft.
    }
  },
  reset(scope) {
    get().update(scope, { progress: emptyProgress(), showPanel: true });
  },
}));
