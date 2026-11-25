import { Button, ToggleButton, Tooltip } from "@heroui/react";
import {
  IconCopy,
  IconDownload,
  IconStar,
  IconStarFilled,
  type TablerIcon,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { CollapsibleText } from "../../components/collapsible-text";
import { DialogClose } from "../../components/overlays/dialog-close";
import { UiIcon } from "../../components/ui-icon";
import { useLocale } from "../../i18n/locale-store";
import { useMessages } from "../../i18n/messages";
import { copyToClipboard } from "../../lib/clipboard";
import { downloadAsset } from "../generation/generation-client";
import { ReferenceThumbnails } from "../generation/references/reference-thumbnails";
import { useAssetFavorite } from "./asset-library-client";
import { assetsMessages } from "./assets-messages";

type PreviewAsset = {
  id: string;
  taskPublicId?: string | null | undefined;
  imagePublicId?: string | null | undefined;
  createdAt?: string | null | undefined;
  prompt?: string | null | undefined;
  references?: string[] | undefined;
};

type PreviewLabels = {
  info: string;
  closePreview: string;
  favoriteAsset: string;
  downloadAsset?: string;
};

/** 图片和视频预览共用素材信息、收藏下载、提示词复制与参考图。 */
export function AssetPreviewDetails({
  asset,
  icon,
  title,
  labels,
  children,
}: {
  asset: PreviewAsset;
  icon: TablerIcon;
  title: string;
  labels: PreviewLabels;
  children?: ReactNode;
}) {
  const t = useMessages(assetsMessages);
  const locale = useLocale();
  return (
    <aside className="image-preview-info image-preview-workspace-panel" aria-label={labels.info}>
      <div className="image-preview-close-row">
        <DialogClose label={labels.closePreview} className="image-preview-close" fullScreen />
      </div>
      <header className="image-preview-head">
        <span className="image-preview-model">
          <UiIcon icon={icon} />
          <span>{title}</span>
        </span>
        <AssetPreviewActions id={asset.id} labels={labels} />
      </header>
      <div className="image-preview-facts">
        <span className="image-preview-fact-label">
          {t.taskId}
          {asset.taskPublicId ?? "—"}
        </span>
        {asset.taskPublicId && (
          <CopyPreviewValue value={asset.taskPublicId} label={t.copyTaskId(asset.taskPublicId)} />
        )}
        {asset.imagePublicId && (
          <>
            <span className="image-preview-fact-label">
              {t.imageId}
              {asset.imagePublicId}
            </span>
            <CopyPreviewValue
              value={asset.imagePublicId}
              label={t.copyImageId(asset.imagePublicId)}
            />
          </>
        )}
        {asset.createdAt && (
          <time className="image-preview-time" dateTime={asset.createdAt}>
            {new Date(asset.createdAt).toLocaleString(locale, { hour12: false })}
          </time>
        )}
      </div>
      {asset.prompt && (
        <section className="image-preview-section" aria-label={t.description}>
          <h2>
            <span>{t.description}</span>
            <CopyPreviewValue value={asset.prompt} label={t.copyDescription} />
          </h2>
          <CollapsibleText
            key={asset.id}
            text={asset.prompt}
            className="image-preview-prompt"
            textContainerClassName="image-preview-description-text"
          />
        </section>
      )}
      {asset.references && asset.references.length > 0 && (
        <section className="image-preview-section" aria-label={t.references}>
          <h2>
            <span>{t.references}</span>
          </h2>
          <ReferenceThumbnails ids={asset.references} />
        </section>
      )}
      {children}
    </aside>
  );
}

function AssetPreviewActions({ id, labels }: { id: string; labels: PreviewLabels }) {
  const t = useMessages(assetsMessages);
  const { favorite, toggle } = useAssetFavorite(id);
  return (
    <span className="image-preview-tools">
      <Tooltip delay={0}>
        <ToggleButton
          isIconOnly
          variant="ghost"
          className="image-preview-tool"
          aria-label={favorite ? t.unfavorite : labels.favoriteAsset}
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
          variant="tertiary"
          className="image-preview-tool"
          aria-label={labels.downloadAsset ?? t.download}
          onPress={() => downloadAsset(id)}
        >
          <UiIcon icon={IconDownload} />
        </Button>
        <Tooltip.Content placement="top">{t.download}</Tooltip.Content>
      </Tooltip>
    </span>
  );
}

function CopyPreviewValue({ value, label }: { value: string; label: string }) {
  return (
    <Button
      isIconOnly
      variant="tertiary"
      className="image-preview-copy"
      aria-label={label}
      onPress={() => void copyToClipboard(value)}
    >
      <UiIcon icon={IconCopy} size="small" />
    </Button>
  );
}
