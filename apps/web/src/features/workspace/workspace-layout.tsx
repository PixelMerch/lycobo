import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useEffect, useState } from "react";
import { Outlet } from "react-router";
import { ConfirmDialog } from "../../components/overlays/confirm-dialog";
import { useAppLocation } from "../../i18n/use-localized-navigation";
import { rememberCommercePath } from "../commerce/commerce-preferences";
import { GenerationHistory } from "../generation/history/generation-history";
import { HistoryIndex } from "../generation/history/history-index";
import { BackToTopButton } from "../generation/workspace-page";
import { VideoHistory, VideoHistoryRail } from "../video/history/video-history";
import { StoryboardContext } from "../video/storyboard/storyboard-context";
import { useStoryboard } from "../video/storyboard/use-storyboard";
import { useWorkspaceRestore } from "./use-workspace-restore";
import { toolForPath } from "./workspace-state";
import { WorkspaceToolPicker } from "./workspace-tool-picker";
import "./workspace.css";
import { useMessages } from "../../i18n/messages";
import { WorkspaceScrollbar } from "./workspace-scrollbar";
import { workspaceToolMessages } from "./workspace-tool-messages";
import { HistoryDensityToggle, ToolRailCollapseToggle } from "./workspace-view-controls";
import { useWorkspaceView } from "./workspace-view-preferences";

/** 组合工具与历史区域，显式结果定位不覆盖当前创作草稿。 */
export function WorkspaceLayout() {
  const t = useMessages(workspaceToolMessages);
  const { pathname, search } = useAppLocation();
  const [mobilePanel, setMobilePanel] = useState(() =>
    new URLSearchParams(search).has("task") ? "history" : "form",
  );
  const currentTool = toolForPath(pathname);
  const historyTool = currentTool.id;
  const storyboard = useStoryboard(historyTool === "video", setMobilePanel);
  const { restore, restorePending, applyRestore, setRestorePending } =
    useWorkspaceRestore(setMobilePanel);
  useEffect(() => {
    rememberCommercePath(currentTool.path);
  }, [currentTool.path]);
  useEffect(() => {
    if (new URLSearchParams(search).has("task")) setMobilePanel("history");
  }, [search]);
  const toolRailCollapsed = useWorkspaceView((state) => state.toolRailCollapsed);
  const density = useWorkspaceView((state) => state.density);
  return (
    <div
      id="commerce-workspace"
      data-mobile-panel={mobilePanel}
      data-tool={currentTool.id}
      data-tool-rail={toolRailCollapsed ? "collapsed" : "expanded"}
      data-density={historyTool === "video" ? undefined : density}
      className={`workspace unified-workspace${pathname.includes("textile-set") ? " textile-workspace" : ""}`}
    >
      {/* 工具坞：桌面是参数栏左侧的竖排工具栏（底部按钮可收成只有图标），窄屏是历史上方的横排工具栏。 */}
      <div className="workspace-tool-dock">
        <WorkspaceToolPicker />
        <ToolRailCollapseToggle />
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
      <WorkspaceScrollbar />
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
