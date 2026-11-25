import { Button, ToggleButton, ToggleButtonGroup, Tooltip } from "@heroui/react";
import {
  IconCursorText,
  IconHandStop,
  IconNote,
  IconPhotoPlus,
  IconPointer,
} from "@tabler/icons-react";
import type { RefObject } from "react";
import { UiIcon } from "../../components/ui-icon";
import { useMessages } from "../../i18n/messages";
import { freeCanvasMessages } from "./free-canvas-messages";
import type { FreeCanvasTool } from "./free-canvas-state";

/** 画布底部浮动工具条：选择、移动、文字、便签与本地图片。 */
export function FreeCanvasToolbar({
  tool,
  fileInput,
  onTool,
}: {
  tool: FreeCanvasTool;
  fileInput: RefObject<HTMLInputElement | null>;
  onTool: (tool: FreeCanvasTool) => void;
}) {
  const t = useMessages(freeCanvasMessages);
  const tools: { id: FreeCanvasTool; icon: typeof IconPointer; label: string }[] = [
    { id: "select", icon: IconPointer, label: t.tool.select },
    { id: "hand", icon: IconHandStop, label: t.tool.hand },
    { id: "text", icon: IconCursorText, label: t.tool.text },
    { id: "note", icon: IconNote, label: t.tool.note },
  ];
  return (
    <fieldset aria-label={t.tools} className="fc-tools">
      <ToggleButtonGroup
        aria-label={t.tools}
        className="fc-tool-group"
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
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <span aria-hidden="true" className="fc-tool-divider" />
      <Tooltip delay={200}>
        <Button
          isIconOnly
          aria-label={t.addImage}
          className="fc-tool-add"
          onPress={() => fileInput.current?.click()}
        >
          <UiIcon icon={IconPhotoPlus} size="default" />
        </Button>
        <Tooltip.Content placement="top">{t.addImage}</Tooltip.Content>
      </Tooltip>
    </fieldset>
  );
}
