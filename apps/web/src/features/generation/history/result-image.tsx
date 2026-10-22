import { Button, ToggleButton, Tooltip } from "@heroui/react";
import { IconDownload, IconStar, IconStarFilled } from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import { assetContentUrl, downloadAsset } from "../generation-client";
import { useStudioStore } from "../studio-state";

export function ResultImage({
  assetId,
  position,
  prompt,
  onPreview,
}: {
  assetId: string;
  position: number;
  prompt: string;
  onPreview: (trigger: HTMLElement) => void;
}) {
  const favorite = useStudioStore((s) => s.favorites.includes(assetId));
  const toggleFavorite = useStudioStore((s) => s.toggleFavorite);
  return (
    <div className="generation-media">
      <Button
        variant="tertiary"
        className="generation-media-open"
        aria-label={`预览图片 ${position + 1}`}
        onPress={(event) => {
          // The controlled modal captures the active element when it mounts.
          // Virtual clicks may activate this button without first focusing it.
          if (event.target instanceof HTMLElement) {
            event.target.focus({ preventScroll: true });
            onPreview(event.target);
          }
        }}
      >
        <img
          src={assetContentUrl(assetId, true)}
          loading="lazy"
          alt={`${prompt}，图片${position + 1}`}
        />
      </Button>
      <div className="generation-media-actions">
        <Tooltip delay={0}>
          <Button
            isIconOnly
            variant="tertiary"
            className="generation-media-action"
            aria-label="下载原图"
            onPress={() => downloadAsset(assetId)}
          >
            <UiIcon icon={IconDownload} />
          </Button>
          <Tooltip.Content placement="top">下载原图</Tooltip.Content>
        </Tooltip>
        <Tooltip delay={0}>
          <ToggleButton
            isIconOnly
            variant="ghost"
            className="generation-media-action"
            aria-label={favorite ? "取消收藏" : "收藏图片"}
            isSelected={favorite}
            onChange={() => toggleFavorite(assetId)}
          >
            <UiIcon icon={favorite ? IconStarFilled : IconStar} />
          </ToggleButton>
          <Tooltip.Content placement="top">{favorite ? "取消收藏" : "收藏"}</Tooltip.Content>
        </Tooltip>
      </div>
    </div>
  );
}
