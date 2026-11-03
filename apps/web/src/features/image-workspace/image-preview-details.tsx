import { Button, ToggleButton, Tooltip } from "@heroui/react";
import {
  IconBrandOpenai,
  IconCopy,
  IconDownload,
  IconStar,
  IconStarFilled,
} from "@tabler/icons-react";
import { CollapsibleText } from "../../components/collapsible-text";
import { DialogClose } from "../../components/dialog-close";
import { UiIcon } from "../../components/ui-icon";
import { copyToClipboard } from "../../lib/clipboard";
import { useAssetFavorite } from "../assets/asset-library-client";
import { downloadAsset } from "../generation/generation-client";
import { ReferenceThumbnails } from "../generation/references/reference-thumbnails";
import type { PreviewImage, PreviewMeta } from "./image-preview";

function CopyIconButton({ value, label }: { value: string; label: string }) {
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
  return (
    <aside className="image-preview-info image-preview-workspace-panel" aria-label="图片信息">
      <div className="image-preview-close-row">
        <DialogClose label="关闭图片预览" className="image-preview-close" fullScreen />
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
              aria-label={favorite ? "取消收藏" : "收藏图片"}
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
              aria-label="下载"
              onPress={() => downloadAsset(active.id)}
            >
              <UiIcon icon={IconDownload} />
            </Button>
            <Tooltip.Content placement="top">下载</Tooltip.Content>
          </Tooltip>
        </span>
      </header>
      <div className="image-preview-facts">
        <span className="image-preview-fact-label">任务ID：{meta.taskPublicId ?? "—"}</span>
        {meta.taskPublicId && (
          <CopyIconButton value={meta.taskPublicId} label={`复制任务 ID ${meta.taskPublicId}`} />
        )}
        {meta.imagePublicId && (
          <>
            <span className="image-preview-fact-label">图片ID：{meta.imagePublicId}</span>
            <CopyIconButton
              value={meta.imagePublicId}
              label={`复制图片 ID ${meta.imagePublicId}`}
            />
          </>
        )}
        {meta.createdAt && (
          <time className="image-preview-time" dateTime={meta.createdAt}>
            {new Date(meta.createdAt).toLocaleString("zh-CN", {
              hour12: false,
            })}
          </time>
        )}
      </div>
      {meta.prompt && (
        <section className="image-preview-section" aria-label="创意描述">
          <h2>
            <span>创意描述</span>
            <CopyIconButton value={meta.prompt} label="复制创意描述" />
          </h2>
          <CollapsibleText
            key={active.id}
            text={meta.prompt}
            className="image-preview-prompt"
            textContainerClassName="image-preview-description-text"
          />
        </section>
      )}
      {/* References reuse the history thumbnails; a task without any
       * reference hides the whole section, title included. */}
      {meta.references && meta.references.length > 0 && (
        <section className="image-preview-section" aria-label="参考图">
          <h2>
            <span>参考图</span>
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
          局部编辑
        </Button>
      </div>
    </aside>
  );
}
