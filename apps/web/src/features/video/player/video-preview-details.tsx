import { Button, ToggleButton, Tooltip } from "@heroui/react";
import { IconDownload, IconMovie, IconStar, IconStarFilled } from "@tabler/icons-react";
import { CollapsibleText } from "../../../components/collapsible-text";
import { DialogClose } from "../../../components/overlays/dialog-close";
import { UiIcon } from "../../../components/ui-icon";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { useAssetFavorite } from "../../assets/asset-library-client";
import { downloadAsset } from "../../generation/generation-client";
import { ReferenceThumbnails } from "../../generation/references/reference-thumbnails";
import { CopyIconButton } from "../../image-workspace/image-preview-details";
import type { PreviewVideo } from "./video-player-dialog";
import { videoPlayerMessages } from "./video-player-messages";

/** 视频预览右侧的信息面板：与图片详情相同的布局，用视频参数代替局部编辑。 */
export function VideoPreviewDetails({ video }: { video: PreviewVideo }) {
  const { favorite, toggle } = useAssetFavorite(video.id);
  const t = useMessages(videoPlayerMessages);
  const locale = useLocale();
  return (
    <aside className="image-preview-info image-preview-workspace-panel" aria-label={t.info}>
      <div className="image-preview-close-row">
        <DialogClose label={t.closePreview} className="image-preview-close" fullScreen />
      </div>
      <header className="image-preview-head">
        <span className="image-preview-model">
          <UiIcon icon={IconMovie} size="default" />
          <span>{t.videoTool}</span>
        </span>
        <span className="image-preview-tools">
          <Tooltip delay={0}>
            <ToggleButton
              isIconOnly
              variant="ghost"
              className="image-preview-tool"
              aria-label={favorite ? t.unfavorite : t.favoriteVideo}
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
              aria-label={t.downloadVideo}
              onPress={() => downloadAsset(video.id)}
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
          {video.taskPublicId ?? "—"}
        </span>
        {video.taskPublicId && (
          <CopyIconButton value={video.taskPublicId} label={t.copyTaskId(video.taskPublicId)} />
        )}
        {video.createdAt && (
          <time className="image-preview-time" dateTime={video.createdAt}>
            {new Date(video.createdAt).toLocaleString(locale, { hour12: false })}
          </time>
        )}
      </div>
      {video.prompt && (
        <section className="image-preview-section" aria-label={t.description}>
          <h2>
            <span>{t.description}</span>
            <CopyIconButton value={video.prompt} label={t.copyDescription} />
          </h2>
          <CollapsibleText
            key={video.id}
            text={video.prompt}
            className="image-preview-prompt"
            textContainerClassName="image-preview-description-text"
          />
        </section>
      )}
      {video.references && video.references.length > 0 && (
        <section className="image-preview-section" aria-label={t.references}>
          <h2>
            <span>{t.references}</span>
          </h2>
          <ReferenceThumbnails ids={video.references} />
        </section>
      )}
      {video.params && video.params.length > 0 && (
        <section className="image-preview-section" aria-label={t.params}>
          <h2>
            <span>{t.params}</span>
          </h2>
          <dl className="video-preview-params">
            {video.params.map((param) => (
              <div key={param.label}>
                <dt>{param.label}</dt>
                <dd>{param.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </aside>
  );
}
