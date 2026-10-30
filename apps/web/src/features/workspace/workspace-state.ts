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
  },
  {
    id: "textile",
    name: "家纺套图",
    path: "/commerce/textile-set",
    category: "套图与裂变",
    image: "/studio/textile-views/front.webp",
    description: "同一商品，多视角展示",
  },
  {
    id: "variation",
    name: "智能裂变",
    path: "/commerce/smart-variation",
    category: "套图与裂变",
    image: "/studio/models/image-2-3.webp",
    description: "确认逐张方案，再批量生成",
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
        ? variation.image
          ? [variation.image]
          : []
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
  } else if (to === "/commerce/smart-variation" && !variation.image) {
    variation.update({ image: mainImage });
  }
}
