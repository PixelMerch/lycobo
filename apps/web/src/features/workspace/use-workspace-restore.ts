import { imageResolutionSchema, mainImageModelIds } from "@lycoboai/contracts";
import { useState } from "react";
import { useAppNavigate } from "../../i18n/use-localized-navigation";
import { useReplicaDraft } from "../commerce/replica/replica-state";
import { useSmartVariationDraft } from "../commerce/smart-variation/smart-variation-state";
import { useTextileSetDraft } from "../commerce/textile-set/textile-set-state";
import type { HistoryRestore } from "../generation/history/history-task-tools";
import { useStudioStore } from "../generation/studio-state";

type RestoredTask = Parameters<HistoryRestore>[0];

/** 恢复历史前确认覆盖目标工具草稿，不因工具切换或后台完成丢失输入。 */
export function useWorkspaceRestore(setMobilePanel: (value: string) => void) {
  const navigate = useAppNavigate();
  const [restorePending, setRestorePending] = useState<RestoredTask | null>(null);
  const applyRestore = ({ model, draft, textileSet, variation, replica }: RestoredTask) => {
    if (replica) {
      useReplicaDraft.getState().update({
        draft: { ...draft, count: "1" },
        target: draft.references[0] ?? null,
        products: draft.references.slice(1),
      });
      void navigate("/commerce/replica");
    } else if (variation) {
      useSmartVariationDraft.getState().update({
        planId: variation.planId,
        description: draft.prompt,
        references: draft.references,
        ratio: draft.ratio,
        resolution: draft.resolution,
        items: variation.items.map((item) => ({ ...item, selected: true })),
      });
      void navigate("/commerce/smart-variation");
    } else if (textileSet) {
      useTextileSetDraft.getState().update({
        mainImage: draft.references[0] ?? null,
        detailImages: draft.references.slice(1, 6),
        views: textileSet.views,
        ratio: draft.ratio,
        resolution: imageResolutionSchema.parse(draft.resolution),
      });
      void navigate("/commerce/textile-set");
    } else {
      const studio = useStudioStore.getState();
      const targetModel = mainImageModelIds.some((id) => id === model)
        ? model
        : mainImageModelIds[0];
      // 旧型号仍可浏览；重新创作时只带回草稿，使用当前可选型号。
      studio.updateDraft(targetModel, draft);
      studio.setActiveModel(targetModel);
      void navigate("/commerce/create");
    }
    setRestorePending(null);
    setMobilePanel("form");
  };
  const restore: HistoryRestore = (task) => {
    const textile = useTextileSetDraft.getState();
    const draft = useStudioStore.getState().drafts[task.model];
    const variation = useSmartVariationDraft.getState();
    const variationOccupied =
      !!variation.description.trim() ||
      variation.references.length > 0 ||
      variation.items.length > 0;
    const textileOccupied =
      !!textile.mainImage || textile.detailImages.length > 0 || textile.views.length > 0;
    const imageOccupied = !!draft?.prompt.trim() || !!draft?.references.length;
    let occupied = imageOccupied;
    if (task.replica) {
      const replica = useReplicaDraft.getState();
      occupied = !!replica.target || !!replica.products.length || !!replica.draft.prompt.trim();
    } else if (task.variation) occupied = variationOccupied;
    else if (task.textileSet) occupied = textileOccupied;
    if (occupied) setRestorePending(task);
    else applyRestore(task);
  };
  return { restore, restorePending, applyRestore, setRestorePending };
}
