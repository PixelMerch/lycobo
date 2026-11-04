import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useVideoDraft } from "./video-state";

export function VideoModeSwitch() {
  const mode = useVideoDraft((state) => state.mode);
  const update = useVideoDraft((state) => state.update);
  return (
    <ToggleButtonGroup
      className="video-mode-switch"
      aria-label="视频创作模式"
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[mode]}
      onSelectionChange={(keys) =>
        update({ mode: keys.has("storyboard") ? "storyboard" : "direct" })
      }
    >
      <ToggleButton id="direct">直接生成</ToggleButton>
      <ToggleButton id="storyboard">TK 分镜创作</ToggleButton>
    </ToggleButtonGroup>
  );
}
