import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { imageResolutionSchema } from "@lycoboai/contracts";
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { useTextileSetDraft } from "../commerce/textile-set/textile-set-state";
import { GenerationHistory } from "../generation/history/generation-history";
import { HistoryIndex } from "../generation/history/history-index";
import type { HistoryRestore } from "../generation/history/history-task-tools";
import { useStudioStore } from "../generation/studio-state";
import { BackToTopButton } from "../generation/workspace-page";
import { restoreMainImagePrompt, useWorkspaceState } from "./workspace-state";
import { WorkspaceHistoryFilter, WorkspaceToolPicker } from "./workspace-tool-picker";
import "./workspace.css";

type RestoredTask = Parameters<HistoryRestore>[0];
export function WorkspaceLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const remember = useWorkspaceState((state) => state.setLastPath);
  const [mobilePanel, setMobilePanel] = useState("form");
  const [filter, setFilter] = useState<"all" | "create" | "textile">("all");
  const [restorePending, setRestorePending] = useState<RestoredTask | null>(null);
  useEffect(() => {
    remember(pathname);
  }, [pathname, remember]);
  const applyRestore = ({ model, draft, textileSet }: RestoredTask) => {
    if (textileSet) {
      useTextileSetDraft.getState().update({
        mainImage: draft.references[0] ?? null,
        detailImages: draft.references.slice(1, 6),
        views: textileSet.views,
        ratio: draft.ratio,
        resolution: imageResolutionSchema.parse(draft.resolution),
      });
      navigate("/commerce/textile-set");
    } else {
      const studio = useStudioStore.getState();
      const restored = restoreMainImagePrompt(draft.prompt);
      useWorkspaceState.getState().setPurpose(restored.purpose);
      studio.updateDraft(model, { ...draft, prompt: restored.prompt });
      studio.setActiveModel(model);
      navigate("/create");
    }
    setRestorePending(null);
    setMobilePanel("form");
  };
  const restore: HistoryRestore = (task) => {
    const textile = useTextileSetDraft.getState();
    const draft = useStudioStore.getState().drafts[task.model];
    const occupied = task.textileSet
      ? !!textile.mainImage || textile.detailImages.length > 0 || textile.views.length > 0
      : !!draft?.prompt.trim() || !!draft?.references.length;
    if (occupied) setRestorePending(task);
    else applyRestore(task);
  };
  return (
    <div
      data-mobile-panel={mobilePanel}
      className={`workspace unified-workspace${pathname.includes("textile-set") ? " textile-workspace" : ""}`}
    >
      <WorkspaceToolPicker />
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
      <Outlet />
      <section className="results-panel" aria-label="工作区历史记录">
        <div className="workspace-history-heading">
          <h1>历史记录</h1>
          <WorkspaceHistoryFilter value={filter} onChange={setFilter} />
        </div>
        <GenerationHistory tool={filter} onRestore={restore} />
      </section>
      <HistoryIndex tool={filter} />
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
