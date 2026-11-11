import { pendingVariationPlanSchema } from "@lycoboai/contracts";
import { currentMessages } from "../../../i18n/messages";
import { variationMessages } from "./variation-messages";

type PlanningDraft = { description: string; references: readonly { id: string }[] };

/** 保存规划幂等请求并同时启动上传，返回文本输入时不等待素材就绪。 */
export function preparePendingPlan(
  storageKey: string,
  draft: PlanningDraft,
  upload: () => Promise<unknown>,
) {
  let saved: unknown = null;
  try {
    saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
  } catch {
    sessionStorage.removeItem(storageKey);
  }
  const referenceIds = draft.references.map((reference) => reference.id);
  if (
    saved &&
    typeof saved === "object" &&
    "referenceIds" in saved &&
    JSON.stringify(saved.referenceIds) !== JSON.stringify(referenceIds)
  )
    throw new Error(currentMessages(variationMessages).restoreReferences);
  let pending = pendingVariationPlanSchema.safeParse(saved);
  if (pending.success && pending.data.input.description.trim() !== draft.description.trim())
    throw new Error(currentMessages(variationMessages).restoreBrief);
  if (!pending.success) {
    const value = {
      key: crypto.randomUUID(),
      referenceIds,
      input: {
        description: draft.description,
        referenceAssetIds: [],
        referenceCount: draft.references.length,
      },
    };
    sessionStorage.setItem(storageKey, JSON.stringify(value));
    pending = pendingVariationPlanSchema.safeParse(value);
  }
  if (!pending.success) throw new Error(currentMessages(variationMessages).cannotSave);
  // 上传失败不丢弃文本计划；生图提交会复用缓存、等待上传或重试，才允许创建付费任务。
  void Promise.allSettled([upload()]);
  return pending.data;
}
