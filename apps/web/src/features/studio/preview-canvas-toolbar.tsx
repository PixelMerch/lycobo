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
import type { LocalRepairEditor } from "./use-local-repair";

function subscribeToolbarViewport(onChange: () => void) {
  const media = window.matchMedia("(min-width: 768px)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const getToolbarViewport = () => window.matchMedia("(min-width: 768px)").matches;
const getServerToolbarViewport = () => false;

export function PreviewCanvasToolbar({
  editor,
  repairing,
  onTool,
}: {
  editor: LocalRepairEditor;
  repairing: boolean;
  onTool: (tool: string) => void;
}) {
  const vertical = useSyncExternalStore(
    subscribeToolbarViewport,
    getToolbarViewport,
    getServerToolbarViewport,
  );
  const orientation = vertical ? "vertical" : "horizontal";
  return (
    <div className="preview-canvas-dock">
      <Toolbar className="preview-canvas-toolbar" aria-label="画布工具" orientation={orientation}>
        <ToggleButtonGroup
          size="sm"
          orientation={orientation}
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[editor.tool]}
          aria-label="画布工具选择"
          onSelectionChange={(keys) => {
            const next = Array.from(keys)[0];
            if (next) onTool(String(next));
          }}
        >
          <Tooltip delay={0}>
            <ToggleButton id="select" isIconOnly aria-label="选择区域">
              <UiIcon icon={IconPointer} />
            </ToggleButton>
            <Tooltip.Content>选择</Tooltip.Content>
          </Tooltip>
          <Tooltip delay={0}>
            <ToggleButton id="rect" isIconOnly aria-label="框选区域" isDisabled={!!editor.locked}>
              <UiIcon icon={IconRectangle} />
            </ToggleButton>
            <Tooltip.Content>框选修改区域</Tooltip.Content>
          </Tooltip>
          <Tooltip delay={0}>
            <ToggleButton id="hand" isIconOnly aria-label="拖动画布">
              <UiIcon icon={IconHandStop} />
            </ToggleButton>
            <Tooltip.Content>抓手 · 按住空格</Tooltip.Content>
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
            aria-label="撤销区域修改"
            isDisabled={!repairing || !editor.canUndo}
            onPress={editor.undo}
          >
            <UiIcon icon={IconArrowBackUp} />
          </Button>
          <Button
            size="sm"
            isIconOnly
            variant="ghost"
            aria-label="重做区域修改"
            isDisabled={!repairing || !editor.canRedo}
            onPress={editor.redo}
          >
            <UiIcon icon={IconArrowForwardUp} />
          </Button>
        </ButtonGroup>
      </Toolbar>
      {/* The count is only useful once regions exist; the empty state keeps the
       * canvas clean instead of showing a permanent "0 / 8". */}
      {editor.draft.regions.length > 0 && (
        <span
          className="preview-canvas-status"
          data-editing={repairing}
          title={`已选 ${editor.draft.regions.length} 个区域，最多 8 个`}
        >
          {editor.draft.regions.length} / 8
        </span>
      )}
    </div>
  );
}
