import { Button } from "@heroui/react";
import { useState } from "react";
import { ConfirmDialog } from "../../../components/overlays/confirm-dialog";
import { ReferenceThumbnails } from "../../generation/references/reference-thumbnails";
import { VideoHistoryMeta, VideoHistoryPrompt } from "../history/video-task-card";
import type { Production } from "./video-production-progress";
import { VideoProductionProgress } from "./video-production-progress";

export const videoProductionCardId = "video-production-card";

/** A run that has no video task yet: it looks like the history entry it becomes. */
export function VideoProductionCard({ production }: { production: Production }) {
  const [confirm, setConfirm] = useState(false);
  const { description, references, seconds, startedAt, progress } = production.draft;
  const assetIds = references.flatMap(({ assetId }) => (assetId ? [assetId] : []));
  return (
    <article
      id={videoProductionCardId}
      className="generation-job video-history-card"
      aria-label="正在制作的视频"
    >
      <header className="video-history-header">
        <VideoHistoryMeta
          createdAt={startedAt}
          aspectRatio="9:16"
          seconds={seconds}
          referenceCount={references.length}
        />
        {production.canAbandon && (
          <div className="history-task-actions">
            <Button variant="secondary" className="copy-prompt" onPress={() => setConfirm(true)}>
              放弃制作
            </Button>
          </div>
        )}
      </header>
      <div className="history-prompt">
        {description && <VideoHistoryPrompt text={description} />}
        {assetIds.length === references.length ? (
          <ReferenceThumbnails ids={assetIds} label="视频参考图" />
        ) : (
          // Still uploading: only the local previews exist.
          <section className="generation-output-thumbnails" aria-label="视频参考图">
            {references.map(({ id, src, thumbnailSrc }, index) => (
              <span className="generation-output-thumbnail" key={id}>
                <img src={thumbnailSrc ?? src} alt={`参考图片 ${index + 1} 缩略图`} />
              </span>
            ))}
          </section>
        )}
      </div>
      <VideoProductionProgress production={production} task={undefined} />
      <ConfirmDialog
        isOpen={confirm}
        title="放弃这次制作？"
        content={
          progress.batchId
            ? "不会再提交视频，已扣的画面积分不退回。场景描述和商品图会回到创作区。"
            : "还没有开始生成画面，不会扣积分。场景描述和商品图会回到创作区。"
        }
        confirmLabel="放弃制作"
        cancelLabel="保留"
        tone="danger"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          production.abandon();
        }}
      />
    </article>
  );
}
