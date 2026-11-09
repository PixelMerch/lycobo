import { Button, ToggleButton, Tooltip } from "@heroui/react";
import type { ImageAsset } from "@lycoboai/contracts";
import { IconDownload, IconPlayerPlayFilled, IconStar, IconStarFilled } from "@tabler/icons-react";
import type { CSSProperties } from "react";
import { UiIcon } from "../../components/ui-icon";
import { AssetImage } from "../generation/asset-image";
import { downloadAsset } from "../generation/generation-client";
import { formatVideoTime } from "../video/player/use-video-playback";
import { assetToolName } from "./asset-filters";
import { useAssetFavorite } from "./asset-library-client";
import "../video/video.css";
import type { Locale } from "../../i18n/locale";
import { useLocale } from "../../i18n/locale-store";
import { useMessages } from "../../i18n/messages";
import { displayPrompt } from "../generation/prompt-display";
import { assetsMessages } from "./assets-messages";

const time = (iso: string, locale: Locale) =>
  new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * 素材卡：点图片打开预览；收藏和下载是悬停或键盘聚焦时出现的并列按钮，不嵌套在图片按钮里。
 */
export function AssetTile({
  asset,
  modelName,
  style,
  onOpen,
}: {
  asset: ImageAsset;
  modelName: string;
  style: CSSProperties;
  onOpen: (trigger: HTMLElement) => void;
}) {
  const { favorite, toggle } = useAssetFavorite(asset.id, asset.favorite ?? false);
  const t = useMessages(assetsMessages);
  const locale = useLocale();
  const generatedSource = asset.tool ? assetToolName(asset.tool, locale) : t.generatedFallback;
  const source = asset.kind === "reference" ? t.uploaded : generatedSource;
  const prompt = asset.prompt ? displayPrompt(asset.prompt, locale) : undefined;
  const video = asset.type === "video";
  const videoSpecs = [
    asset.resolution,
    asset.duration_seconds ? formatVideoTime(asset.duration_seconds) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div
      className="asset-tile"
      style={style}
      data-media-type={asset.type}
      data-favorite={favorite || undefined}
    >
      <Button
        variant="tertiary"
        className="asset-tile-open"
        aria-label={t.viewAsset(video, prompt ?? asset.public_id ?? source)}
        onPress={(event) => {
          // 预览挂载时把当前焦点记为关闭后的返回位置，这里先手动聚焦。
          if (event.target instanceof HTMLElement) {
            event.target.focus({ preventScroll: true });
            onOpen(event.target);
          }
        }}
      >
        <AssetImage
          assetId={asset.id}
          thumbnail
          width={asset.width}
          height={asset.height}
          alt={prompt ?? t.assetAlt(source, video)}
          loading="lazy"
        />
        {video && (
          <span className="video-cover-play" aria-hidden="true">
            <UiIcon icon={IconPlayerPlayFilled} size="navigation" />
          </span>
        )}
      </Button>
      {(video || asset.kind === "output") && (
        <span className="model-tag asset-tile-badge">
          <span>{video ? source : modelName}</span>
        </span>
      )}
      {favorite && (
        <span className="asset-tile-star" aria-hidden="true">
          <UiIcon icon={IconStarFilled} size="small" />
        </span>
      )}
      {video && videoSpecs && <span className="asset-tile-specs">{videoSpecs}</span>}
      <AssetTileActions asset={asset} source={source} favorite={favorite} toggle={toggle} />
    </div>
  );
}

function AssetTileActions({
  asset,
  source,
  favorite,
  toggle,
}: {
  asset: ImageAsset;
  source: string;
  favorite: boolean;
  toggle: ReturnType<typeof useAssetFavorite>["toggle"];
}) {
  const video = asset.type === "video";
  const t = useMessages(assetsMessages);
  const locale = useLocale();
  const favoriteAction = video ? t.favoriteVideo : t.favoriteImage;
  return (
    <div className="asset-tile-foot">
      <span className="asset-tile-meta">
        {!video && (
          <>
            <b>{source}</b>
            <span> · {time(asset.created_at, locale)}</span>
          </>
        )}
      </span>
      <Tooltip delay={0}>
        <ToggleButton
          isIconOnly
          size="sm"
          variant="ghost"
          className="asset-tile-action"
          aria-label={favorite ? t.unfavorite : favoriteAction}
          isSelected={favorite}
          onChange={toggle}
        >
          <UiIcon icon={favorite ? IconStarFilled : IconStar} />
        </ToggleButton>
        <Tooltip.Content placement="top">{favorite ? t.unfavorite : t.favorite}</Tooltip.Content>
      </Tooltip>
      <Tooltip delay={0}>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          className="asset-tile-action"
          aria-label={video ? t.downloadVideo : t.downloadOriginal}
          onPress={() => downloadAsset(asset.id)}
        >
          <UiIcon icon={IconDownload} />
        </Button>
        <Tooltip.Content placement="top">{t.download}</Tooltip.Content>
      </Tooltip>
    </div>
  );
}
