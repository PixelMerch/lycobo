import { Button, ToggleButton, Tooltip } from "@heroui/react";
import { IconDownload, IconMovie, IconStar, IconStarFilled } from "@tabler/icons-react";
import { CollapsibleText } from "../../components/collapsible-text";
import { DialogClose } from "../../components/dialog-close";
import { UiIcon } from "../../components/ui-icon";
import { useAssetFavorite } from "../assets/asset-library-client";
import { downloadAsset } from "../generation/generation-client";
import { ReferenceThumbnails } from "../generation/references/reference-thumbnails";
import { CopyIconButton } from "../image-workspace/image-preview-details";
import type { PreviewVideo } from "./video-player-dialog";

/** The image detail's information column, with video parameters in place of local editing. */
export function VideoPreviewDetails({ video }: { video: PreviewVideo }) {
  const { favorite, toggle } = useAssetFavorite(video.id);
  return (
    <aside className="image-preview-info image-preview-workspace-panel" aria-label="视频信息">
      <div className="image-preview-close-row">
        <DialogClose label="关闭视频预览" className="image-preview-close" fullScreen />
      </div>
      <header className="image-preview-head">
        <span className="image-preview-model">
          <UiIcon icon={IconMovie} size="default" />
          <span>视频创作</span>
        </span>
        <span className="image-preview-tools">
          <Tooltip delay={0}>
            <ToggleButton
              isIconOnly
              variant="ghost"
              className="image-preview-tool"
              aria-label={favorite ? "取消收藏" : "收藏视频"}
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
              variant="tertiary"
              className="image-preview-tool"
              aria-label="下载视频"
              onPress={() => downloadAsset(video.id)}
            >
              <UiIcon icon={IconDownload} />
            </Button>
            <Tooltip.Content placement="top">下载</Tooltip.Content>
          </Tooltip>
        </span>
      </header>
      <div className="image-preview-facts">
        <span className="image-preview-fact-label">任务ID：{video.taskPublicId ?? "—"}</span>
        {video.taskPublicId && (
          <CopyIconButton value={video.taskPublicId} label={`复制任务 ID ${video.taskPublicId}`} />
        )}
        {video.createdAt && (
          <time className="image-preview-time" dateTime={video.createdAt}>
            {new Date(video.createdAt).toLocaleString("zh-CN", { hour12: false })}
          </time>
        )}
      </div>
      {video.prompt && (
        <section className="image-preview-section" aria-label="创意描述">
          <h2>
            <span>创意描述</span>
            <CopyIconButton value={video.prompt} label="复制创意描述" />
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
        <section className="image-preview-section" aria-label="参考图">
          <h2>
            <span>参考图</span>
          </h2>
          <ReferenceThumbnails ids={video.references} />
        </section>
      )}
      {video.params && video.params.length > 0 && (
        <section className="image-preview-section" aria-label="视频参数">
          <h2>
            <span>视频参数</span>
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
