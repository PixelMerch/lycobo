import {
  Button,
  ButtonGroup,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
} from "@heroui/react";
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconHandStop,
  IconPointer,
  IconRectangle,
} from "@tabler/icons-react";
import { useSyncExternalStore } from "react";
import { UiIcon } from "../../components/ui-icon";
import { useMessages } from "../../i18n/messages";
import { imageWorkspaceMessages } from "./image-workspace-messages";
import type { LocalRepairEditor } from "./local-edit/use-local-repair";

function subscribeToolbarViewport(onChange: () => void) {
  const media = window.matchMedia("(min-width: 768px)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const getToolbarViewport = () => window.matchMedia("(min-width: 768px)").matches;
const getServerToolbarViewport = () => false;

/** 画布工具坞：选择、框选与抓手工具，以及区域修改的撤销与重做。 */
export function PreviewCanvasToolbar({
  editor,
  repairing,
  onTool,
}: {
  editor: LocalRepairEditor;
  repairing: boolean;
  onTool: (tool: string) => void;
}) {
  const t = useMessages(imageWorkspaceMessages);
  const vertical = useSyncExternalStore(
    subscribeToolbarViewport,
    getToolbarViewport,
    getServerToolbarViewport,
  );
  const orientation = vertical ? "vertical" : "horizontal";
  return (
    <div className="preview-canvas-dock">
      <Toolbar
        className="preview-canvas-toolbar"
        aria-label={t.canvasTools}
        orientation={orientation}
      >
        <ToggleButtonGroup
          size="sm"
          orientation={orientation}
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[editor.tool]}
          aria-label={t.toolChoice}
          onSelectionChange={(keys) => {
            const next = Array.from(keys)[0];
            if (next) onTool(String(next));
          }}
        >
          <Tooltip delay={0}>
            <ToggleButton id="select" isIconOnly aria-label={t.selectRegion}>
              <UiIcon icon={IconPointer} />
            </ToggleButton>
            <Tooltip.Content>{t.select}</Tooltip.Content>
          </Tooltip>
          <Tooltip delay={0}>
            <ToggleButton
              id="rect"
              isIconOnly
              aria-label={t.drawRegion}
              isDisabled={!!editor.locked}
            >
              <UiIcon icon={IconRectangle} />
            </ToggleButton>
            <Tooltip.Content>{t.drawRegionHint}</Tooltip.Content>
          </Tooltip>
          <Tooltip delay={0}>
            <ToggleButton id="hand" isIconOnly aria-label={t.panCanvas}>
              <UiIcon icon={IconHandStop} />
            </ToggleButton>
            <Tooltip.Content>{t.panHint}</Tooltip.Content>
          </Tooltip>
        </ToggleButtonGroup>
        <ButtonGroup
          className="preview-canvas-history"
          variant="ghost"
          size="sm"
          orientation={orientation}
        >
          <Button
            size="sm"
            isIconOnly
            variant="ghost"
            aria-label={t.undoRegion}
            isDisabled={!repairing || !editor.canUndo}
            onPress={editor.undo}
          >
            <UiIcon icon={IconArrowBackUp} />
          </Button>
          <Button
            size="sm"
            isIconOnly
            variant="ghost"
            aria-label={t.redoRegion}
            isDisabled={!repairing || !editor.canRedo}
            onPress={editor.redo}
          >
            <UiIcon icon={IconArrowForwardUp} />
          </Button>
        </ButtonGroup>
      </Toolbar>
      {/* 有选区后才显示数量；没有选区时不常驻显示“0 / 8”，保持画布干净。 */}
      {editor.draft.regions.length > 0 && (
        <span
          className="preview-canvas-status"
          data-editing={repairing}
          title={t.regionCount(editor.draft.regions.length)}
        >
          {editor.draft.regions.length} / 8
        </span>
      )}
    </div>
  );
}
