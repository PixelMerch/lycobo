import { Button, Toolbar, Tooltip } from "@heroui/react";
import { IconRotate, IconRotateClockwise, IconZoomIn, IconZoomOut } from "@tabler/icons-react";
import { useMessages } from "../../i18n/messages";
import { componentsMessages } from "../components-messages";
import { UiIcon } from "../ui-icon";
/** 图片浏览工具栏：左右旋转与缩放。 */
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
  const t = useMessages(componentsMessages);
  return (
    <Toolbar className="browse-image-toolbar" aria-label={t.viewerTools} inert={!ready}>
      <Tooltip>
        <Button
          size="lg"
          variant="ghost"
          isIconOnly
          aria-label={t.rotateLeft}
          onPress={() => rotate(-90)}
        >
          <UiIcon icon={IconRotate} size="action" />
        </Button>
        <Tooltip.Content>{t.rotateLeft}</Tooltip.Content>
      </Tooltip>
      <Tooltip>
        <Button
          size="lg"
          variant="ghost"
          isIconOnly
          aria-label={t.rotateRight}
          onPress={() => rotate(90)}
        >
          <UiIcon icon={IconRotateClockwise} size="action" />
        </Button>
        <Tooltip.Content>{t.rotateRight}</Tooltip.Content>
      </Tooltip>
      <Tooltip>
        <Button
          size="lg"
          variant="ghost"
          isIconOnly
          aria-label={t.zoomOutImage}
          isDisabled={zoom <= 25}
          onPress={() => zoomStep(-25)}
        >
          <UiIcon icon={IconZoomOut} size="action" />
        </Button>
        <Tooltip.Content>{t.zoomOut}</Tooltip.Content>
      </Tooltip>
      <output className="browse-image-position" aria-label={t.zoomLevel} aria-live="polite">
        {Math.round(zoom)}%
      </output>
      <Tooltip>
        <Button
          size="lg"
          variant="ghost"
          isIconOnly
          aria-label={t.zoomInImage}
          isDisabled={zoom >= 500}
          onPress={() => zoomStep(25)}
        >
          <UiIcon icon={IconZoomIn} size="action" />
        </Button>
        <Tooltip.Content>{t.zoomIn}</Tooltip.Content>
      </Tooltip>
    </Toolbar>
  );
}
