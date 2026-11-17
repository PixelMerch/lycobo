import { Button, ToggleButton, ToggleButtonGroup, Tooltip } from "@heroui/react";
import {
  IconCursorText,
  IconHandStop,
  IconNote,
  IconPhotoPlus,
  IconPointer,
  IconZoomIn,
  IconZoomOut,
} from "@tabler/icons-react";
import type { RefObject } from "react";
import { UiIcon } from "../../components/ui-icon";
import { useMessages } from "../../i18n/messages";
import { freeCanvasMessages } from "./free-canvas-messages";
import type { FreeCanvasTool } from "./free-canvas-state";

/** 自由画布工具栏：工具切换、本地图片、缩放与视图重置。 */
export function FreeCanvasToolbar({
  tool,
  zoom,
  fileInput,
  onTool,
  onZoom,
  onResetView,
}: {
  tool: FreeCanvasTool;
  zoom: number;
  fileInput: RefObject<HTMLInputElement | null>;
  onTool: (tool: FreeCanvasTool) => void;
  onZoom: (zoom: number) => void;
  onResetView: () => void;
}) {
  const t = useMessages(freeCanvasMessages);
  const tools: { id: FreeCanvasTool; icon: typeof IconPointer; label: string }[] = [
    { id: "select", icon: IconPointer, label: t.tool.select },
    { id: "hand", icon: IconHandStop, label: t.tool.hand },
    { id: "text", icon: IconCursorText, label: t.tool.text },
    { id: "note", icon: IconNote, label: t.tool.note },
  ];
  return (
    <div className="free-canvas-toolbar">
      <ToggleButtonGroup
        aria-label={t.tools}
        className="free-canvas-tools"
        disallowEmptySelection
        isDetached
        selectedKeys={[tool]}
        selectionMode="single"
        onSelectionChange={(keys) => {
          const [next] = keys;
          if (next === "select" || next === "hand" || next === "text" || next === "note")
            onTool(next);
        }}
      >
        {tools.map(({ id, icon, label }) => (
          <ToggleButton aria-label={label} id={id} key={id}>
            <UiIcon icon={icon} size="default" />
            <span>{label}</span>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Button size="sm" variant="secondary" onPress={() => fileInput.current?.click()}>
        <UiIcon icon={IconPhotoPlus} size="small" />
        {t.addImage}
      </Button>
      <div className="free-canvas-zoom">
        <Tooltip delay={200}>
          <Button
            isIconOnly
            aria-label={t.zoomOut}
            size="sm"
            variant="tertiary"
            onPress={() => onZoom(zoom - 0.1)}
          >
            <UiIcon icon={IconZoomOut} size="small" />
          </Button>
          <Tooltip.Content placement="bottom">{t.zoomOut}</Tooltip.Content>
        </Tooltip>
        <output aria-label={t.zoomLevel}>{Math.round(zoom * 100)}%</output>
        <Tooltip delay={200}>
          <Button
            isIconOnly
            aria-label={t.zoomIn}
            size="sm"
            variant="tertiary"
            onPress={() => onZoom(zoom + 0.1)}
          >
            <UiIcon icon={IconZoomIn} size="small" />
          </Button>
          <Tooltip.Content placement="bottom">{t.zoomIn}</Tooltip.Content>
        </Tooltip>
        <Button size="sm" variant="tertiary" onPress={onResetView}>
          {t.zoomReset}
        </Button>
      </div>
    </div>
  );
}
