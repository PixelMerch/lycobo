import { create } from "zustand";
import type { ReferenceImage } from "../../generation/studio-state";

export type VariationPlanItem = { id: string; title: string; prompt: string; selected: boolean };
const colors = ["橙色", "粉色", "灰色", "牛仔蓝", "米色", "棕色", "黄色", "亮灰绿色", "玫粉色"];
export function examplePlan(): VariationPlanItem[] {
  return colors.map((color, index) => ({
    id: `example-${index + 1}`,
    title: `${color}款`,
    prompt: `以商品参考图的构图和视角为基础，将被子与枕套的主色调整为${color}，白色部分保持不变。保留商品的花型、绗缝工艺、包边和面料质感，保持卧室场景、光线及商品比例一致。输出一张独立的电商商品图，不拼图，不添加文字或水印。`,
    selected: true,
  }));
}

type Draft = {
  image: ReferenceImage | null;
  description: string;
  model: string;
  ratio: string;
  resolution: string;
  items: VariationPlanItem[];
};
/** Session-only UI draft. Example plans never represent an AI response or a paid task. */
export const useSmartVariationDraft = create<Draft & { update: (patch: Partial<Draft>) => void }>(
  (set) => ({
    image: null,
    description: "",
    model: "",
    ratio: "1:1",
    resolution: "1.5K",
    items: examplePlan(),
    update: (patch) => set(patch),
  }),
);
