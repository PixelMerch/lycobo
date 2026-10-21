import { type ImageResolution, imageGenerationInputSchema } from "@lycoboai/contracts";
import { create } from "zustand";

export type RepairRegion = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  prompt: string;
};
export type RepairDraft = { regions: RepairRegion[]; jobId?: string };
const empty: RepairDraft = { regions: [] };
// Session-only editing drafts, separated by authenticated identity and source asset.
export const useRepairDrafts = create<{
  drafts: Record<string, RepairDraft>;
  update: (key: string, patch: Partial<RepairDraft>) => void;
}>((set) => ({
  drafts: {},
  update: (key, patch) =>
    set((state) => ({
      drafts: { ...state.drafts, [key]: { ...(state.drafts[key] ?? empty), ...patch } },
    })),
}));
export const emptyRepairDraft = empty;

export function constrainRegion(region: RepairRegion, width: number, height: number): RepairRegion {
  const w = Math.min(width, Math.max(1, region.width));
  const h = Math.min(height, Math.max(1, region.height));
  return {
    ...region,
    width: w,
    height: h,
    x: Math.max(0, Math.min(width - w, region.x)),
    y: Math.max(0, Math.min(height - h, region.y)),
  };
}

export function repairOutput(
  width: number,
  height: number,
): { ratio: string; resolution: ImageResolution } {
  const ratios = imageGenerationInputSchema.shape.aspectRatio.unwrap().options;
  const ratio = ratios.reduce((best, candidate) => {
    const distance = (value: string) => {
      const [w = 1, h = 1] = value.split(":").map(Number);
      return Math.abs(Math.log(w / h / (width / height)));
    };
    return distance(candidate) < distance(best) ? candidate : best;
  });
  return {
    ratio,
    resolution:
      Math.max(width, height) <= 1024 ? "1K" : Math.max(width, height) <= 2048 ? "2K" : "4K",
  };
}

export function repairPrompt(regions: RepairRegion[], width: number, height: number) {
  return [
    `请基于唯一参考图生成一张局部修改版。原图坐标尺寸为 ${width}×${height}，坐标原点为左上角，x 向右、y 向下，单位为原图像素。`,
    "按以下各区域说明修改，尽量保留区域外内容、人物身份、商品、构图和光线。不要绘制选框、编号或批注文字。",
    ...regions.map(
      (region, index) =>
        `区域 ${index + 1}：左上角 (${Math.round(region.x)}, ${Math.round(region.y)})，宽 ${Math.round(region.width)}，高 ${Math.round(region.height)}。修改要求：${region.prompt.trim()}`,
    ),
  ].join("\n");
}
