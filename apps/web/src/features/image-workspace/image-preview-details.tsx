import { Button, ToggleButton, Tooltip } from "@heroui/react";
import {
  IconBrandOpenai,
  IconCopy,
  IconDownload,
  IconStar,
  IconStarFilled,
} from "@tabler/icons-react";
import { CollapsibleText } from "../../components/collapsible-text";
import { DialogClose } from "../../components/overlays/dialog-close";
import { UiIcon } from "../../components/ui-icon";
import { useLocale } from "../../i18n/locale-store";
import { useMessages } from "../../i18n/messages";
import { copyToClipboard } from "../../lib/clipboard";
import { useAssetFavorite } from "../assets/asset-library-client";
import { downloadAsset } from "../generation/generation-client";
import { displayPrompt } from "../generation/prompt-display";
import { ReferenceThumbnails } from "../generation/references/reference-thumbnails";
import type { PreviewImage, PreviewMeta } from "./image-preview";
import { imageWorkspaceMessages } from "./image-workspace-messages";

export function CopyIconButton({ value, label }: { value: string; label: string }) {
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

/** 图片预览右侧的信息面板：模型、收藏与下载、任务与图片 ID、创意描述、参考图和局部编辑入口。 */
export function ImagePreviewDetails({
  source: active,
  meta,
  modelName,
  onRepair,
}: {
  source: PreviewImage;
  meta: PreviewMeta;
  modelName: string;
  onRepair: () => void;
}) {
  const { favorite, toggle } = useAssetFavorite(active.id);
  const t = useMessages(imageWorkspaceMessages);
  const locale = useLocale();
  const prompt = meta.prompt ? displayPrompt(meta.prompt, locale) : meta.prompt;
  return (
    <aside className="image-preview-info image-preview-workspace-panel" aria-label={t.info}>
      <div className="image-preview-close-row">
        <DialogClose label={t.closePreview} className="image-preview-close" fullScreen />
      </div>
      <header className="image-preview-head">
        <span className="image-preview-model">
          <UiIcon icon={IconBrandOpenai} size="default" />
          <span>{modelName}</span>
        </span>
        <span className="image-preview-tools">
          <Tooltip delay={0}>
            <ToggleButton
              isIconOnly
              variant="ghost"
              className="image-preview-tool"
              aria-label={favorite ? t.unfavorite : t.favoriteImage}
              isSelected={favorite}
              onChange={toggle}
            >
              <UiIcon icon={favorite ? IconStarFilled : IconStar} />
            </ToggleButton>
            <Tooltip.Content placement="top">
              {favorite ? t.unfavorite : t.favorite}
            </Tooltip.Content>
          </Tooltip>
          <Tooltip delay={0}>
            <Button
              isIconOnly
              variant="tertiary"
              className="image-preview-tool"
              aria-label={t.download}
              onPress={() => downloadAsset(active.id)}
            >
              <UiIcon icon={IconDownload} />
            </Button>
            <Tooltip.Content placement="top">{t.download}</Tooltip.Content>
          </Tooltip>
        </span>
      </header>
      <div className="image-preview-facts">
        <span className="image-preview-fact-label">
          {t.taskId}
          {meta.taskPublicId ?? "—"}
        </span>
        {meta.taskPublicId && (
          <CopyIconButton value={meta.taskPublicId} label={t.copyTaskId(meta.taskPublicId)} />
        )}
        {meta.imagePublicId && (
          <>
            <span className="image-preview-fact-label">
              {t.imageId}
              {meta.imagePublicId}
            </span>
            <CopyIconButton value={meta.imagePublicId} label={t.copyImageId(meta.imagePublicId)} />
          </>
        )}
        {meta.createdAt && (
          <time className="image-preview-time" dateTime={meta.createdAt}>
            {new Date(meta.createdAt).toLocaleString(locale, {
              hour12: false,
            })}
          </time>
        )}
      </div>
      {prompt && (
        <section className="image-preview-section" aria-label={t.description}>
          <h2>
            <span>{t.description}</span>
            <CopyIconButton value={prompt} label={t.copyDescription} />
          </h2>
          <CollapsibleText
            key={active.id}
            text={prompt}
            className="image-preview-prompt"
            textContainerClassName="image-preview-description-text"
          />
        </section>
      )}
      {/* 参考图复用历史缩略图；没有参考图的任务连标题一起隐藏。 */}
      {meta.references && meta.references.length > 0 && (
        <section className="image-preview-section" aria-label={t.references}>
          <h2>
            <span>{t.references}</span>
          </h2>
          <ReferenceThumbnails ids={meta.references} />
        </section>
      )}
      <div className="image-preview-tools-footer">
        <Button
          id="open-local-repair"
          className="image-preview-edit-action"
          variant="secondary"
          size="md"
          onPress={() => onRepair()}
        >
          {t.localEdit}
        </Button>
      </div>
    </aside>
  );
}
