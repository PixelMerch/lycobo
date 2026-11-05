import { Button, ToggleButton, Tooltip } from "@heroui/react";
import type { ImageAsset } from "@lycoboai/contracts";
import { IconDownload, IconPlayerPlayFilled, IconStar, IconStarFilled } from "@tabler/icons-react";
import type { CSSProperties } from "react";
import { UiIcon } from "../../components/ui-icon";
import { AssetImage } from "../generation/asset-image";
import { downloadAsset } from "../generation/generation-client";
import { formatVideoTime } from "../video/use-video-playback";
import { assetToolName } from "./asset-filters";
import { useAssetFavorite } from "./asset-library-client";
import "../video/video.css";

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * The picture opens the existing preview; favorite and download are sibling buttons revealed on
 * hover or keyboard focus, never nested inside the picture button.
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
  const generatedSource = asset.tool ? assetToolName(asset.tool) : "生成";
  const source = asset.kind === "reference" ? "上传" : generatedSource;
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
        aria-label={`查看${video ? "视频" : "图片"}：${asset.prompt ?? asset.public_id ?? source}`}
        onPress={(event) => {
          // The preview records the focused element as its return target when it mounts.
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
          alt={asset.prompt ?? `${source}${video ? "视频封面" : "图片"}`}
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
  const favoriteAction = video ? "收藏视频" : "收藏图片";
  return (
    <div className="asset-tile-foot">
      <span className="asset-tile-meta">
        {!video && (
          <>
            <b>{source}</b>
            <span> · {time(asset.created_at)}</span>
          </>
        )}
      </span>
      <Tooltip delay={0}>
        <ToggleButton
          isIconOnly
          size="sm"
          variant="ghost"
          className="asset-tile-action"
          aria-label={favorite ? "取消收藏" : favoriteAction}
          isSelected={favorite}
          onChange={toggle}
        >
          <UiIcon icon={favorite ? IconStarFilled : IconStar} />
        </ToggleButton>
        <Tooltip.Content placement="top">{favorite ? "取消收藏" : "收藏"}</Tooltip.Content>
      </Tooltip>
      <Tooltip delay={0}>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          className="asset-tile-action"
          aria-label={video ? "下载视频" : "下载原图"}
          onPress={() => downloadAsset(asset.id)}
        >
          <UiIcon icon={IconDownload} />
        </Button>
        <Tooltip.Content placement="top">下载</Tooltip.Content>
      </Tooltip>
    </div>
  );
}
