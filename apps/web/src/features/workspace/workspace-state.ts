import { dashboardToolPaths } from "../../lib/dashboard-paths";
import { useReplicaDraft } from "../commerce/replica/replica-state";
import { useSmartVariationDraft } from "../commerce/smart-variation/smart-variation-state";
import { useTextileSetDraft } from "../commerce/textile-set/textile-set-state";
import { useStudioStore } from "../generation/studio-state";
import { useVideoDraft } from "../video/video-state";
import { workspaceToolHeroImages } from "./workspace-tool-categories";

/** 四个电商工具的 id、路径和示例图；名称与用法文案在 workspace-tool-messages.ts。 */
export const workspaceTools = [
  {
    id: "create",
    path: dashboardToolPaths.create,
    hero: workspaceToolHeroImages.create,
  },
  {
    id: "textile",
    path: dashboardToolPaths.textile,
    bannerImages: [
      "/studio/textile-views/front.webp",
      "/studio/textile-views/angled-level.webp",
      "/studio/textile-views/pillow.webp",
      "/studio/textile-views/bed-end.webp",
      "/studio/textile-views/fabric.webp",
    ],
  },
  {
    id: "variation",
    path: dashboardToolPaths.variation,
    hero: workspaceToolHeroImages.variation,
  },
  {
    id: "replica",
    path: dashboardToolPaths.replica,
    hero: workspaceToolHeroImages.replica,
  },
  {
    id: "video",
    path: dashboardToolPaths.video,
    hero: "/studio/tool-heroes/video.webp",
  },
] as const;
/** 视频未开放，创作入口只显示已启用的图片工具。 */
export const visibleWorkspaceTools = workspaceTools.filter((tool) => tool.id !== "video");

/** 根据业务路径找到当前工具。 */
export const toolForPath = (path: string) =>
  workspaceTools.find((tool) => tool.path === path.replace(/\/+$/, "")) ?? workspaceTools[0];
function referencesForPath(path: string) {
  if (path === dashboardToolPaths.textile) {
    const textile = useTextileSetDraft.getState();
    return [textile.mainImage, ...textile.detailImages].filter((image) => image !== null);
  }
  if (path === dashboardToolPaths.variation) return useSmartVariationDraft.getState().references;
  if (path === dashboardToolPaths.replica) {
    return useReplicaDraft.getState().products;
  }
  if (path === dashboardToolPaths.video) {
    const video = useVideoDraft.getState();
    return [video.firstFrame, video.lastFrame, ...video.extraReferences].filter(
      (image) => image !== null,
    );
  }
  const studio = useStudioStore.getState();
  return studio.drafts[studio.activeModel]?.references ?? [];
}

/** 只为尚无参考图的目标工具带入商品图，切换时不覆盖现有草稿。 */
export function shareProductReference(from: string, to: string) {
  const studio = useStudioStore.getState();
  const textile = useTextileSetDraft.getState();
  const variation = useSmartVariationDraft.getState();
  const video = useVideoDraft.getState();
  const references = referencesForPath(from);
  const mainImage = references[0];
  if (!mainImage) return;
  const destinationHasReferences = !!studio.drafts[studio.activeModel]?.references.length;
  if (to === dashboardToolPaths.replica && !useReplicaDraft.getState().products.length) {
    useReplicaDraft.getState().update({ products: [mainImage] });
  } else if (to === dashboardToolPaths.create && !destinationHasReferences) {
    studio.updateDraft(studio.activeModel, { references: references.slice(0, 5) });
  } else if (to === dashboardToolPaths.textile && !textile.mainImage) {
    textile.update({
      mainImage,
      ...(textile.detailImages.length ? {} : { detailImages: references.slice(1, 6) }),
    });
  } else if (to === dashboardToolPaths.variation && !variation.references.length) {
    variation.update({ references: references.slice(0, 5) });
  } else if (to === dashboardToolPaths.video && !video.firstFrame) {
    video.update({ firstFrame: mainImage, reuseReferences: false });
  }
}
