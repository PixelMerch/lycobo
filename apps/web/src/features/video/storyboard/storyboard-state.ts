import {
  imageJobSchema,
  storedStoryboardSchema,
  storyboardImageLimit,
  storyboardRequestSchema,
} from "@lycoboai/contracts";
import { create } from "zustand";
import type { ReferenceImage } from "../../generation/studio-state";

const frameSchema = storyboardRequestSchema.options[1].shape.shots.element
  .pick({ assetId: true, title: true })
  .extend({
    position: imageJobSchema.shape.items.element.shape.position
      .int()
      .min(0)
      .max(storyboardImageLimit - 1),
  });
const progressSchema = storedStoryboardSchema.shape.progress.extend({
  frames: frameSchema.array().max(storyboardImageLimit).optional(),
  frameJobStatus: imageJobSchema.shape.status.optional(),
});
const storedDraftSchema = storedStoryboardSchema.extend({ progress: progressSchema });

type Draft = {
  description: string;
  references: ReferenceImage[];
  count: number;
  seconds: number;
  progress: ReturnType<typeof progressSchema.parse>;
};
export const emptyStoryboard: Draft = {
  description: "",
  references: [],
  count: 3,
  seconds: 10,
  progress: {},
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
}>((set, get) => ({
  drafts: {},
  load(scope) {
    if (!scope || get().drafts[scope]) return;
    let draft = emptyStoryboard;
    try {
      const parsed = storedDraftSchema.safeParse(
        JSON.parse(sessionStorage.getItem(key(scope)) ?? "null"),
      );
      if (parsed.success) {
        const { originalAssetId, additionalOriginalAssetIds, ...rest } = parsed.data;
        draft = {
          ...rest,
          references: originalAssetId
            ? [originalAssetId, ...(additionalOriginalAssetIds ?? [])].map(originalReference)
            : [],
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
          originalAssetId: next.references[0]?.assetId,
          additionalOriginalAssetIds: next.references
            .slice(1)
            .flatMap(({ assetId }) => (assetId ? [assetId] : [])),
          progress: next.progress,
        }),
      );
    } catch {
      // The current workspace still retains its draft.
    }
  },
}));
