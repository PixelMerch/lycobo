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
/** Drafts are session-only and separated by authenticated identity and source asset. */
export function repairDraftKey(
  identity: { organizationId: string; userId: string } | null | undefined,
  sourceId: string,
) {
  return `${identity?.organizationId}:${identity?.userId}:${sourceId}`;
}
export const useRepairDrafts = create<{
  drafts: Record<string, RepairDraft>;
  update: (key: string, patch: Partial<RepairDraft>) => void;
  clear: (key: string) => void;
}>((set) => ({
  drafts: {},
  update: (key, patch) =>
    set((state) => ({
      drafts: { ...state.drafts, [key]: { ...(state.drafts[key] ?? empty), ...patch } },
    })),
  clear: (key) =>
    set((state) => {
      const entry = state.drafts[key];
      if (!entry) return state;
      const drafts = { ...state.drafts };
      // Submitted edits are restored from the server; discard only this session's work.
      delete drafts[key];
      return { drafts };
    }),
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

function repairResolution(edge: number): ImageResolution {
  if (edge <= 1254) return "1.5K";
  return edge <= 2048 ? "2K" : "4K";
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
    resolution: repairResolution(Math.max(width, height)),
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
