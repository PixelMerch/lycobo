import { Button, ToggleButton, Tooltip } from "@heroui/react";
import type { ImageAsset } from "@lycoboai/contracts";
import {
  IconCheck,
  IconDownload,
  IconPhotoOff,
  IconPlayerPlayFilled,
  IconStar,
  IconStarFilled,
  IconUpload,
} from "@tabler/icons-react";
import type { CSSProperties } from "react";
import { UiIcon } from "../../components/ui-icon";
import { AssetImage } from "../generation/asset-image";
import { downloadAsset } from "../generation/generation-client";
import { formatVideoTime } from "../video/player/use-video-playback";
import { assetToolName } from "./asset-filters";
import { useAssetFavorite } from "./asset-library-client";
import "../video/video.css";
import "./asset-tile.css";
import type { Locale } from "../../i18n/locale";
import { useLocale } from "../../i18n/locale-store";
import { useMessages } from "../../i18n/messages";
import { displayPrompt } from "../generation/prompt-display";
import { assetsMessages } from "./assets-messages";

const time = (iso: string, locale: Locale) =>
  new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false });

/** 一张素材卡的多选状态：是否在多选、这张是否选中，以及勾选（不在多选时是开始多选）的回调。 */
export type AssetTileSelection = { selecting: boolean; selected: boolean; onSelect: () => void };

type AssetsText = (typeof assetsMessages)[Locale];

/** 卡片上要显示的文字：来源（功能名或“上传”）、可读名称、替代文字与视频规格。 */
function describeAsset(asset: ImageAsset, t: AssetsText, locale: Locale) {
  const generatedSource = asset.tool ? assetToolName(asset.tool, locale) : t.generatedFallback;
  const source = asset.kind === "reference" ? t.uploaded : generatedSource;
  const prompt = asset.prompt ? displayPrompt(asset.prompt, locale) : undefined;
  const video = asset.type === "video";
  const duration = asset.duration_seconds ? formatVideoTime(asset.duration_seconds) : null;
  // 图片也带着任务的清晰度，规格只在视频封面上显示。
  const specs = video ? [asset.resolution, duration] : [];
  return {
    source,
    video,
    name: prompt ?? asset.public_id ?? source,
    alt: prompt ?? t.assetAlt(source, video),
    videoSpecs: specs.filter(Boolean).join(" · "),
  };
}

type AssetDetails = ReturnType<typeof describeAsset>;

/** 卡片主体：平时点它打开预览；多选时换成勾选开关，点它选中或取消。 */
function AssetTileOpen({
  asset,
  details,
  selection,
  unavailable,
  onOpen,
  onUnavailable,
}: {
  asset: ImageAsset;
  details: AssetDetails;
  selection: AssetTileSelection;
  unavailable: boolean;
  onOpen: (trigger: HTMLElement) => void;
  onUnavailable: () => void;
}) {
  const t = useMessages(assetsMessages);
  const cover = (
    <>
      <AssetImage
        assetId={asset.id}
        thumbnail
        width={asset.width}
        height={asset.height}
        alt={details.alt}
        loading="lazy"
        onUnavailable={onUnavailable}
        fallback={
          <span className="asset-tile-unavailable">
            <UiIcon icon={IconPhotoOff} size="illustration" />
            {t.imageUnavailable}
          </span>
        }
      />
      {details.video && (
        <span className="video-cover-play" aria-hidden="true">
          <UiIcon icon={IconPlayerPlayFilled} size="navigation" />
        </span>
      )}
    </>
  );
  if (selection.selecting)
    return (
      <ToggleButton
        className="asset-tile-open"
        aria-label={t.selectAsset(details.video, details.name)}
        isSelected={selection.selected}
        isDisabled={unavailable}
        onChange={selection.onSelect}
      >
        {cover}
      </ToggleButton>
    );
  return (
    <Button
      variant="tertiary"
      className="asset-tile-open"
      aria-label={t.viewAsset(details.video, details.name)}
      onPress={(event) => {
        // 预览挂载时把当前焦点记为关闭后的返回位置，这里先手动聚焦。
        if (event.target instanceof HTMLElement) {
          event.target.focus({ preventScroll: true });
          onOpen(event.target);
        }
      }}
    >
      {cover}
    </Button>
  );
}

/**
 * 素材卡：平时只显示图片，收藏过的有星标，看全部来源时上传的标“上传”；悬停或键盘聚焦时出现左上勾选圈、
 * 右上收藏和下载、底部来源与时间。多选时整张卡就是勾选开关，点它选中或取消，不打开预览。
 * 图片加载失败时只保留占位和来源时间：不能下载，也不出现收藏与勾选（用户 2026-11-10 要求）。
 */
export function AssetTile({
  asset,
  style,
  showUploadTag,
  selection,
  unavailable,
  onOpen,
  onUnavailable,
}: {
  asset: ImageAsset;
  style: CSSProperties;
  showUploadTag: boolean;
  selection: AssetTileSelection;
  unavailable: boolean;
  onOpen: (trigger: HTMLElement) => void;
  onUnavailable: () => void;
}) {
  const { favorite, toggle } = useAssetFavorite(asset.id, asset.favorite ?? false);
  const t = useMessages(assetsMessages);
  const locale = useLocale();
  const details = describeAsset(asset, t, locale);
  return (
    <div
      className="asset-tile"
      style={style}
      data-media-type={asset.type}
      data-favorite={favorite || undefined}
      data-selecting={selection.selecting || undefined}
      data-selected={selection.selected || undefined}
      data-unavailable={unavailable || undefined}
    >
      <AssetTileOpen
        asset={asset}
        details={details}
        selection={selection}
        unavailable={unavailable}
        onOpen={onOpen}
        onUnavailable={onUnavailable}
      />
      {/* 勾选圈是给鼠标的快捷入口；键盘和读屏用“多选”按钮进入，多选时整张卡就是开关。 */}
      {!unavailable && (
        <ToggleButton
          isIconOnly
          excludeFromTabOrder
          aria-hidden="true"
          className="asset-tile-check"
          isSelected={selection.selected}
          onChange={selection.onSelect}
        >
          <UiIcon icon={IconCheck} size="small" />
        </ToggleButton>
      )}
      {favorite && (
        <span className="asset-tile-star" aria-hidden="true">
          <UiIcon icon={IconStarFilled} size="small" />
        </span>
      )}
      {showUploadTag && asset.kind === "reference" && (
        <span className="asset-tile-upload" aria-hidden="true">
          <UiIcon icon={IconUpload} size="small" />
          {t.uploaded}
        </span>
      )}
      {details.videoSpecs && <span className="asset-tile-specs">{details.videoSpecs}</span>}
      {!selection.selecting && (
        <>
          {!details.video && (
            <span className="asset-tile-foot">
              <b>{details.source}</b> · {time(asset.created_at, locale)}
            </span>
          )}
          {!unavailable && <AssetTileActions asset={asset} favorite={favorite} toggle={toggle} />}
        </>
      )}
    </div>
  );
}

function AssetTileActions({
  asset,
  favorite,
  toggle,
}: {
  asset: ImageAsset;
  favorite: boolean;
  toggle: ReturnType<typeof useAssetFavorite>["toggle"];
}) {
  const video = asset.type === "video";
  const t = useMessages(assetsMessages);
  const favoriteAction = video ? t.favoriteVideo : t.favoriteImage;
  return (
    <div className="asset-tile-actions">
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
