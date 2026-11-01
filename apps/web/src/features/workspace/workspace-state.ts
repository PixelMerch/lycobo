import { create } from "zustand";
import { useSmartVariationDraft } from "../commerce/smart-variation/smart-variation-state";
import { useTextileSetDraft } from "../commerce/textile-set/textile-set-state";
import { useStudioStore } from "../generation/studio-state";

export const workspaceTools = [
  {
    id: "create",
    name: "主图制作",
    path: "/create",
    category: "主图制作",
    image: "/studio/models/image-2-1.webp",
    description: "场景主图 · 白底主图 · 活动主图",
    caption: "场景 · 白底 · 活动",
    hero: "/studio/tool-heroes/create.webp",
    summary: "一张图讲清卖点：场景、白底、活动主图",
    steps: [
      "上传商品参考图（可选，最多 5 张）",
      "用提示词描述场景、白底或活动风格",
      "选好比例、分辨率与模型，点击生成",
    ],
    examples: [
      "/studio/models/image-2-1.webp",
      "/studio/models/image-2-3.webp",
      "/studio/models/image-2-5-2.webp",
    ],
  },
  {
    id: "textile",
    name: "家纺套图",
    path: "/commerce/textile-set",
    category: "套图与裂变",
    image: "/studio/textile-views/front.webp",
    description: "同一商品，多视角展示",
    caption: "多视角套图",
    hero: "/studio/tool-heroes/textile.webp",
    summary: "上传主图，选择视角，一次生成整套",
    steps: [
      "上传 1 张家纺主图，可补充细节图",
      "在裂变类型里选择需要的视角",
      "选好比例与分辨率，一次生成整套",
    ],
    examples: [
      "/studio/textile-views/front.webp",
      "/studio/textile-views/pillow.webp",
      "/studio/textile-views/fabric.webp",
    ],
  },
  {
    id: "variation",
    name: "智能裂变",
    path: "/commerce/smart-variation",
    category: "套图与裂变",
    image: "/studio/models/image-2-3.webp",
    description: "确认逐张方案，再批量生成",
    caption: "先确认方案",
    hero: "/studio/tool-heroes/variation.webp",
    summary: "先出逐张方案，确认后批量生成",
    steps: ["上传参考图，写下创作需求", "生成计划，逐张检查并修改方案", "确认方案后批量生成"],
    examples: [
      "/studio/bedroom-thumb.webp",
      "/studio/lavender-thumb.webp",
      "/studio/set-thumb.webp",
    ],
  },
] as const;
export const toolForPath = (path: string) =>
  workspaceTools.find((tool) => tool.path === path) ?? workspaceTools[0];
export const useWorkspaceState = create<{
  lastPath: string;
  setLastPath: (path: string) => void;
}>((set) => ({
  lastPath: "/create",
  setLastPath: (lastPath) => set({ lastPath }),
}));

/** Seed only an empty destination; switching never discards an existing tool draft. */
export function shareProductReference(from: string, to: string) {
  const studio = useStudioStore.getState();
  const textile = useTextileSetDraft.getState();
  const variation = useSmartVariationDraft.getState();
  const references =
    from === "/commerce/textile-set"
      ? [textile.mainImage, ...textile.detailImages].filter((image) => image !== null)
      : from === "/commerce/smart-variation"
        ? variation.references
        : (studio.drafts[studio.activeModel]?.references ?? []);
  const mainImage = references[0];
  if (!mainImage) return;
  if (to === "/create" && !studio.drafts[studio.activeModel]?.references.length) {
    studio.updateDraft(studio.activeModel, { references: references.slice(0, 5) });
  } else if (to === "/commerce/textile-set" && !textile.mainImage) {
    textile.update({
      mainImage,
      ...(textile.detailImages.length ? {} : { detailImages: references.slice(1, 6) }),
    });
  } else if (to === "/commerce/smart-variation" && !variation.references.length) {
    variation.update({ references: references.slice(0, 5) });
  }
}
