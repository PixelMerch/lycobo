import { create } from "zustand";
import { type Draft, defaultDraft, type ReferenceImage } from "../../generation/studio-state";

type ReplicaDraft = {
  model: string;
  draft: Draft;
  target: ReferenceImage | null;
  product: ReferenceImage | null;
};

/** 两种图片分槽保存，切换工具不会覆盖风格图或商品图。 */
export const useReplicaDraft = create<
  ReplicaDraft & {
    update: (patch: Partial<ReplicaDraft>) => void;
  }
>((set) => ({
  model: "gpt-image-2.6",
  draft: { ...defaultDraft },
  target: null,
  product: null,
  update: (patch) => set(patch),
}));
