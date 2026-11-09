import { Button, Toolbar, Tooltip } from "@heroui/react";
import { IconRotate, IconRotateClockwise, IconZoomIn, IconZoomOut } from "@tabler/icons-react";
import { UiIcon } from "../ui-icon";
export function ImageViewerToolbar({
  ready,
  zoom,
  rotate,
  zoomStep,
}: {
  ready: boolean;
  zoom: number;
  rotate: (degrees: number) => void;
  zoomStep: (delta: number) => void;
}) {
  return (
    <Toolbar className="browse-image-toolbar" aria-label="图片浏览工具" inert={!ready}>
      <Tooltip>
        <Button
          size="lg"
          variant="ghost"
          isIconOnly
          aria-label="向左旋转"
          onPress={() => rotate(-90)}
        >
          <UiIcon icon={IconRotate} size="action" />
        </Button>
        <Tooltip.Content>向左旋转</Tooltip.Content>
      </Tooltip>
      <Tooltip>
        <Button
          size="lg"
          variant="ghost"
          isIconOnly
          aria-label="向右旋转"
          onPress={() => rotate(90)}
        >
          <UiIcon icon={IconRotateClockwise} size="action" />
        </Button>
        <Tooltip.Content>向右旋转</Tooltip.Content>
      </Tooltip>
      <Tooltip>
        <Button
          size="lg"
          variant="ghost"
          isIconOnly
          aria-label="缩小图片"
          isDisabled={zoom <= 25}
          onPress={() => zoomStep(-25)}
        >
          <UiIcon icon={IconZoomOut} size="action" />
        </Button>
        <Tooltip.Content>缩小</Tooltip.Content>
      </Tooltip>
      <output className="browse-image-position" aria-label="图片缩放比例" aria-live="polite">
        {Math.round(zoom)}%
      </output>
      <Tooltip>
        <Button
          size="lg"
          variant="ghost"
          isIconOnly
          aria-label="放大图片"
          isDisabled={zoom >= 500}
          onPress={() => zoomStep(25)}
        >
          <UiIcon icon={IconZoomIn} size="action" />
        </Button>
        <Tooltip.Content>放大</Tooltip.Content>
      </Tooltip>
    </Toolbar>
  );
}
