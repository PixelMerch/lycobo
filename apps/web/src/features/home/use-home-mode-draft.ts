import { useSmartVariationDraft } from "../commerce/smart-variation/smart-variation-state";
import { useTextileSetDraft } from "../commerce/textile-set/textile-set-state";
import { hasPromptDescription } from "../generation/references/prompt-description";
import { defaultDraft, type ReferenceImage, useStudioStore } from "../generation/studio-state";
import { useVideoDraft, videoPromptLimit } from "../video/video-state";
import type { HomeModeId } from "./home-modes";

const promptLimit = 5000;

/** 首页正在编辑的工具草稿：读写都落在该工具自己的状态里，切换模式互不覆盖。 */
export type HomePromptDraft = {
  references: ReferenceImage[];
  prompt: string;
  setPrompt: (prompt: string) => void;
  setReferences: (images: ReferenceImage[], prompt: string) => void;
  canStart: boolean;
};

function canStartWith(prompt: string, limit: number) {
  return hasPromptDescription(prompt) && prompt.length <= limit;
}

/** 主图制作沿用当前模型的草稿，与工作台完全共享。 */
export function useCreateHomeDraft(): HomePromptDraft {
  const model = useStudioStore((s) => s.activeModel);
  const draft = useStudioStore((s) => s.drafts[model] ?? defaultDraft);
  const updateDraft = useStudioStore((s) => s.updateDraft);
  return {
    references: draft.references,
    prompt: draft.prompt,
    setPrompt: (prompt) => updateDraft(model, { prompt }),
    setReferences: (references, prompt) => updateDraft(model, { references, prompt }),
    canStart: canStartWith(draft.prompt, promptLimit),
  };
}

/** 套图计划只填写商品图和创作需求，计划仍在工作区生成。 */
export function useVariationHomeDraft(): HomePromptDraft {
  const references = useSmartVariationDraft((s) => s.references);
  const description = useSmartVariationDraft((s) => s.description);
  const update = useSmartVariationDraft((s) => s.update);
  return {
    references,
    prompt: description,
    setPrompt: (prompt) => update({ description: prompt }),
    setReferences: (images, prompt) => update({ references: images, description: prompt }),
    canStart: canStartWith(description, promptLimit),
  };
}

/** 视频创作按工作区规则排列图片：第 1 张为主图，其余为补充参考。 */
export function useVideoHomeDraft(): HomePromptDraft {
  const draft = useVideoDraft();
  const references = [draft.firstFrame, draft.lastFrame, ...draft.extraReferences].filter(
    (image) => image !== null,
  );
  return {
    references,
    prompt: draft.prompt,
    setPrompt: (prompt) => draft.update({ prompt }),
    setReferences: (images, prompt) =>
      draft.update({
        firstFrame: images[0] ?? null,
        lastFrame: images[1] ?? null,
        extraReferences: images.slice(2),
        prompt,
        reuseReferences: false,
      }),
    canStart: canStartWith(draft.prompt, videoPromptLimit),
  };
}

/** 家纺裂变把首张图作为主图，其余作为详情图，与工具间带图规则一致。 */
export function useTextileHomeDraft() {
  const mainImage = useTextileSetDraft((s) => s.mainImage);
  const detailImages = useTextileSetDraft((s) => s.detailImages);
  const update = useTextileSetDraft((s) => s.update);
  const references = mainImage ? [mainImage, ...detailImages] : detailImages;
  return {
    references,
    setReferences: (images: ReferenceImage[]) =>
      update({ mainImage: images[0] ?? null, detailImages: images.slice(1) }),
    canStart: references.length > 0,
  };
}

/** 读取某个模式当前的描述，模板据此判断是否需要确认替换。 */
export function readHomePrompt(mode: HomeModeId): string {
  if (mode === "variation") return useSmartVariationDraft.getState().description;
  if (mode === "video") return useVideoDraft.getState().prompt;
  if (mode === "textile") return "";
  const studio = useStudioStore.getState();
  return studio.drafts[studio.activeModel]?.prompt ?? "";
}

/** 把模板描述写进对应工具草稿，已上传图片和参数保持不变。 */
export function writeHomePrompt(mode: HomeModeId, prompt: string) {
  if (mode === "variation") {
    useSmartVariationDraft.getState().update({ description: prompt });
    return;
  }
  if (mode === "video") {
    useVideoDraft.getState().update({ prompt });
    return;
  }
  if (mode === "textile") return;
  const studio = useStudioStore.getState();
  studio.updateDraft(studio.activeModel, { prompt });
}
