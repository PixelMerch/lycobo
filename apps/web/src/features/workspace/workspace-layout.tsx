import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { imageResolutionSchema } from "@lycoboai/contracts";
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { useSmartVariationDraft } from "../commerce/smart-variation/smart-variation-state";
import { useTextileSetDraft } from "../commerce/textile-set/textile-set-state";
import { GenerationHistory } from "../generation/history/generation-history";
import { HistoryIndex } from "../generation/history/history-index";
import type { HistoryRestore } from "../generation/history/history-task-tools";
import { useStudioStore } from "../generation/studio-state";
import { BackToTopButton } from "../generation/workspace-page";
import { StoryboardContext } from "../video/storyboard/storyboard-context";
import { useStoryboard } from "../video/storyboard/use-storyboard";
import { VideoHistory, VideoHistoryRail } from "../video/video-history";
import { toolForPath, useWorkspaceState } from "./workspace-state";
import { WorkspaceToolPicker } from "./workspace-tool-picker";
import "./workspace.css";

type RestoredTask = Parameters<HistoryRestore>[0];
export function WorkspaceLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const remember = useWorkspaceState((state) => state.setLastPath);
  const [mobilePanel, setMobilePanel] = useState("form");
  const currentTool = toolForPath(pathname);
  const historyTool = currentTool.id;
  const storyboard = useStoryboard(historyTool === "video", setMobilePanel);
  const [restorePending, setRestorePending] = useState<RestoredTask | null>(null);
  useEffect(() => {
    remember(pathname);
  }, [pathname, remember]);
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
      studio.updateDraft(model, draft);
      studio.setActiveModel(model);
      void navigate("/create");
    }
    setRestorePending(null);
    setMobilePanel("form");
  };
  const restore: HistoryRestore = (task) => {
    const textile = useTextileSetDraft.getState();
    const draft = useStudioStore.getState().drafts[task.model];
    const variation = useSmartVariationDraft.getState();
    const occupied = task.variation
      ? !!variation.description.trim() ||
        variation.references.length > 0 ||
        variation.items.length > 0
      : task.textileSet
        ? !!textile.mainImage || textile.detailImages.length > 0 || textile.views.length > 0
        : !!draft?.prompt.trim() || !!draft?.references.length;
    if (occupied) setRestorePending(task);
    else applyRestore(task);
  };
  return (
    <div
      data-mobile-panel={mobilePanel}
      data-tool={currentTool.id}
      className={`workspace unified-workspace${pathname.includes("textile-set") ? " textile-workspace" : ""}`}
    >
      <div className="workspace-history-heading">
        <WorkspaceToolPicker />
      </div>
      <ToggleButtonGroup
        className="workspace-mobile-panels"
        aria-label="工作区视图"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[mobilePanel]}
        onSelectionChange={(keys) => {
          const key = Array.from(keys)[0];
          if (key) setMobilePanel(String(key));
        }}
      >
        <ToggleButton id="form">创作</ToggleButton>
        <ToggleButton id="history">历史记录</ToggleButton>
      </ToggleButtonGroup>
      <StoryboardContext.Provider value={storyboard}>
        <Outlet />
      </StoryboardContext.Provider>
      <section className="results-panel" aria-label="工作区历史记录">
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
        title="载入这次创作？"
        content="当前工具还有未提交的内容，载入后将替换该工具的草稿。"
        confirmLabel="载入"
        onCancel={() => setRestorePending(null)}
        onConfirm={() => {
          if (restorePending) applyRestore(restorePending);
        }}
      />
    </div>
  );
}
