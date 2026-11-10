import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { imageResolutionSchema, mainImageModelIds } from "@lycoboai/contracts";
import { useEffect, useState } from "react";
import { Outlet } from "react-router";
import { ConfirmDialog } from "../../components/overlays/confirm-dialog";
import { useAppLocation, useAppNavigate } from "../../i18n/use-localized-navigation";
import { useSmartVariationDraft } from "../commerce/smart-variation/smart-variation-state";
import { useTextileSetDraft } from "../commerce/textile-set/textile-set-state";
import { GenerationHistory } from "../generation/history/generation-history";
import { HistoryIndex } from "../generation/history/history-index";
import type { HistoryRestore } from "../generation/history/history-task-tools";
import { useStudioStore } from "../generation/studio-state";
import { BackToTopButton } from "../generation/workspace-page";
import { VideoHistory, VideoHistoryRail } from "../video/history/video-history";
import { StoryboardContext } from "../video/storyboard/storyboard-context";
import { useStoryboard } from "../video/storyboard/use-storyboard";
import { toolForPath, useWorkspaceState } from "./workspace-state";
import { WorkspaceToolPicker } from "./workspace-tool-picker";
import "./workspace.css";
import { useMessages } from "../../i18n/messages";
import { workspaceToolMessages } from "./workspace-tool-messages";
import {
  ComposerCollapseToggle,
  HistoryDensityToggle,
  useRevealComposerOnEntry,
} from "./workspace-view-controls";
import { useWorkspaceView } from "./workspace-view-preferences";

type RestoredTask = Parameters<HistoryRestore>[0];
/** 组合工具与历史区域，显式结果定位不覆盖当前创作草稿。 */
export function WorkspaceLayout() {
  const t = useMessages(workspaceToolMessages);
  const { pathname, search } = useAppLocation();
  const navigate = useAppNavigate();
  const remember = useWorkspaceState((state) => state.setLastPath);
  const [mobilePanel, setMobilePanel] = useState(() =>
    new URLSearchParams(search).has("task") ? "history" : "form",
  );
  const currentTool = toolForPath(pathname);
  const historyTool = currentTool.id;
  const storyboard = useStoryboard(historyTool === "video", setMobilePanel);
  const [restorePending, setRestorePending] = useState<RestoredTask | null>(null);
  useEffect(() => {
    remember(pathname);
  }, [pathname, remember]);
  useEffect(() => {
    if (new URLSearchParams(search).has("task")) setMobilePanel("history");
  }, [search]);
  const composerCollapsed = useWorkspaceView((state) => state.composerCollapsed);
  const density = useWorkspaceView((state) => state.density);
  useRevealComposerOnEntry();
  const applyRestore = ({ model, draft, textileSet, variation }: RestoredTask) => {
    if (variation) {
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
    // 重新编辑把输入带回参数栏；参数栏收起时先展开，让用户看到带回的内容。
    useWorkspaceView.getState().setComposerCollapsed(false);
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
    if (task.variation) occupied = variationOccupied;
    else if (task.textileSet) occupied = textileOccupied;
    if (occupied) setRestorePending(task);
    else applyRestore(task);
  };
  return (
    <div
      data-mobile-panel={mobilePanel}
      data-tool={currentTool.id}
      data-composer={composerCollapsed ? "collapsed" : "open"}
      data-density={historyTool === "video" ? undefined : density}
      className={`workspace unified-workspace${pathname.includes("textile-set") ? " textile-workspace" : ""}`}
    >
      {/* 工具坞：桌面是参数栏左侧的竖排工具栏（底部带收起按钮），窄屏是历史上方的横排工具栏。 */}
      <div className="workspace-tool-dock">
        <WorkspaceToolPicker />
        <ComposerCollapseToggle />
      </div>
      <div className="workspace-history-heading">
        <h2 className="workspace-history-title">{t.historyHeading}</h2>
        {historyTool !== "video" && <HistoryDensityToggle />}
      </div>
      <ToggleButtonGroup
        className="workspace-mobile-panels"
        aria-label={t.workspaceViews}
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[mobilePanel]}
        onSelectionChange={(keys) => {
          const key = Array.from(keys)[0];
          if (key) setMobilePanel(String(key));
        }}
      >
        <ToggleButton id="form">{t.createView}</ToggleButton>
        <ToggleButton id="history">{t.historyView}</ToggleButton>
      </ToggleButtonGroup>
      <StoryboardContext.Provider value={storyboard}>
        <Outlet />
      </StoryboardContext.Provider>
      <section className="results-panel" aria-label={t.history}>
        {historyTool === "video" ? (
          <VideoHistory onRestore={() => setMobilePanel("form")} production={storyboard} />
        ) : (
          <GenerationHistory key={historyTool} tool={historyTool} onRestore={restore} />
        )}
      </section>
      {historyTool === "video" ? (
        <VideoHistoryRail production={storyboard} />
      ) : (
        <HistoryIndex key={historyTool} tool={historyTool} />
      )}
      <BackToTopButton />
      <ConfirmDialog
        isOpen={restorePending !== null}
        title={t.restoreTitle}
        content={t.restoreContent}
        confirmLabel={t.restore}
        onCancel={() => setRestorePending(null)}
        onConfirm={() => {
          if (restorePending) applyRestore(restorePending);
        }}
      />
    </div>
  );
}
