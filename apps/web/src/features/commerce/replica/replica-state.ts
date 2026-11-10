import { create } from "zustand";
import { type Draft, defaultDraft, type ReferenceImage } from "../../generation/studio-state";

/** 页面沿用2.6能力声明，具体复制渠道由服务端固定到 sunburst。 */
export const replicaModel = "gpt-image-2.6";

type ReplicaDraft = {
  draft: Draft;
  target: ReferenceImage | null;
  products: ReferenceImage[];
};

/** 两种图片分槽保存，切换工具不会覆盖风格图或商品图。 */
export const useReplicaDraft = create<
  ReplicaDraft & {
    update: (patch: Partial<ReplicaDraft>) => void;
  }
>((set) => ({
  draft: { ...defaultDraft },
  target: null,
  products: [],
  update: (patch) => set(patch),
}));
