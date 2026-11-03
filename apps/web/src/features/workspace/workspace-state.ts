import { create } from "zustand";
import { useSmartVariationDraft } from "../commerce/smart-variation/smart-variation-state";
import { useTextileSetDraft } from "../commerce/textile-set/textile-set-state";
import { useStudioStore } from "../generation/studio-state";
import { useVideoDraft } from "../video/video-state";

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
    name: "家纺裂变",
    path: "/commerce/textile-set",
    category: "套图与裂变",
    image: "/studio/textile-views/front.webp",
    description: "一张家纺主图，生成多视角与细节图",
    caption: "多视角 · 细节图",
    hero: "/studio/tool-heroes/textile.webp",
    bannerImages: [
      "/studio/textile-views/front.webp",
      "/studio/textile-views/angled-level.webp",
      "/studio/textile-views/pillow.webp",
      "/studio/textile-views/bed-end.webp",
      "/studio/textile-views/fabric.webp",
    ],
    summary: "一张主图，延展多视角与细节图",
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
    name: "套图计划",
    path: "/commerce/smart-variation",
    category: "套图与裂变",
    image: "/studio/models/image-2-3.webp",
    description: "先规划每张图的内容，确认后批量生成",
    caption: "先规划 · 再生成",
    hero: "/studio/tool-heroes/variation.webp",
    summary: "先规划每张图，确认后批量生成",
    steps: [
      "上传商品参考图，描述整套图片的用途",
      "生成套图计划，逐张检查并修改提示词",
      "确认方案后批量生成",
    ],
    examples: [
      "/studio/bedroom-thumb.webp",
      "/studio/lavender-thumb.webp",
      "/studio/set-thumb.webp",
    ],
  },
  {
    id: "video",
    name: "视频创作",
    path: "/video",
    category: "商品视频",
    image: "/studio/models/image-2-5-2.webp",
    description: "用商品图生成短视频，描述动作与镜头运动",
    caption: "首帧 · 镜头 · 时长",
    hero: "/studio/tool-heroes/video.webp",
    summary: "用商品图生成短视频，生成即将开放",
    steps: [
      "上传商品首帧图，可补充尾帧图",
      "描述画面主体、动作和镜头运动",
      "选择比例、时长与清晰度后生成",
    ],
    examples: [
      "/studio/models/image-2-5-2.webp",
      "/studio/bedroom-thumb.webp",
      "/studio/models/image-2-1.webp",
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
  const video = useVideoDraft.getState();
  const references =
    from === "/commerce/textile-set"
      ? [textile.mainImage, ...textile.detailImages].filter((image) => image !== null)
      : from === "/commerce/smart-variation"
        ? variation.references
        : from === "/video"
          ? [video.firstFrame, video.lastFrame].filter((image) => image !== null)
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
  } else if (to === "/video" && !video.firstFrame) {
    video.update({ firstFrame: mainImage });
  }
}
