import { Button, ToggleButton, Tooltip } from "@heroui/react";
import { IconDownload, IconPhotoOff, IconStar, IconStarFilled } from "@tabler/icons-react";
import { useState } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { useAssetFavorite } from "../../assets/asset-library-client";
import { AssetImage } from "../asset-image";
import { downloadAsset } from "../generation-client";
import { historyMessages } from "./history-messages";

/** 一张生成结果：点开预览，悬停可下载原图或收藏。 */
export function ResultImage({
  assetId,
  position,
  prompt,
  onPreview,
  thumbnail = true,
  width,
  height,
}: {
  assetId: string;
  position: number;
  prompt: string;
  onPreview: (trigger: HTMLElement) => void;
  thumbnail?: boolean;
  width?: number | null;
  height?: number | null;
}) {
  const { favorite, toggle } = useAssetFavorite(assetId);
  const t = useMessages(historyMessages);
  // 图片取不到时显示“图片加载失败”，不能预览，也不显示下载和收藏。
  const [unavailable, setUnavailable] = useState(false);
  return (
    <div className="generation-media">
      <Button
        variant="tertiary"
        className="generation-media-open"
        isDisabled={unavailable}
        aria-label={unavailable ? t.imageUnavailable : t.previewImage(position + 1)}
        onPress={(event) => {
          // 受控弹窗挂载时记住当前焦点；虚拟点击可能不先聚焦按钮，这里手动聚焦。
          if (event.target instanceof HTMLElement) {
            event.target.focus({ preventScroll: true });
            onPreview(event.target);
          }
        }}
      >
        <AssetImage
          assetId={assetId}
          thumbnail={thumbnail}
          width={width ?? undefined}
          height={height ?? undefined}
          style={
            !thumbnail && width && height ? { aspectRatio: `${width} / ${height}` } : undefined
          }
          loading="lazy"
          alt={t.imageAlt(prompt, position + 1)}
          onLoad={() => setUnavailable(false)}
          onUnavailable={() => setUnavailable(true)}
          fallback={
            <span className="generation-media-unavailable" aria-hidden="true">
              <UiIcon icon={IconPhotoOff} size="action" />
              <span>{t.imageUnavailable}</span>
            </span>
          }
        />
      </Button>
      {!unavailable && (
        <div className="generation-media-actions">
          <Tooltip delay={0}>
            <Button
              isIconOnly
              size="sm"
              variant="tertiary"
              className="generation-media-action"
              aria-label={t.downloadOriginal}
              onPress={() => downloadAsset(assetId)}
            >
              <UiIcon icon={IconDownload} size="default" />
            </Button>
            <Tooltip.Content placement="top">{t.download}</Tooltip.Content>
          </Tooltip>
          <Tooltip delay={0}>
            <ToggleButton
              isIconOnly
              size="sm"
              variant="ghost"
              className="generation-media-action"
              aria-label={favorite ? t.unfavorite : t.favoriteImage}
              isSelected={favorite}
              onChange={toggle}
            >
              <UiIcon icon={favorite ? IconStarFilled : IconStar} size="default" />
            </ToggleButton>
            <Tooltip.Content placement="top">
              {favorite ? t.unfavorite : t.favorite}
            </Tooltip.Content>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
