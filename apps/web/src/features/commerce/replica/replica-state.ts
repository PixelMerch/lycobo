import { create } from "zustand";
import { type Draft, defaultDraft, type ReferenceImage } from "../../generation/studio-state";

/** 页面沿用2.6能力声明，具体复制渠道由服务端固定到 sunburst。 */
export const replicaModel = "gpt-image-2.6";

/** 商品参考图的张数上限，上传和素材引用共用。 */
export const replicaProductLimit = 10;

/** 草稿按商品图编号，提交的图片列表在商品图前另有一张风格图。 */
export function shiftReplicaPromptReferences(prompt: string, offset: 1 | -1) {
  return prompt.replace(/@图片([1-9]\d*)/g, (_, raw: string) => {
    const number = Number(raw) + offset;
    return number > 0 ? `@图片${number}` : "";
  });
}

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
