import { Button } from "@heroui/react";
import { useState } from "react";
import { ConfirmDialog } from "../../../components/overlays/confirm-dialog";
import { useMessages } from "../../../i18n/messages";
import { ReferenceThumbnails } from "../../generation/references/reference-thumbnails";
import { VideoHistoryMeta, VideoHistoryPrompt } from "../history/video-task-card";
import { videoMessages } from "../video-messages";
import type { Production } from "./video-production-progress";
import { VideoProductionProgress } from "./video-production-progress";

export const videoProductionCardId = "video-production-card";

/** 还没有视频任务的制作：外观与它将成为的历史记录一致。 */
export function VideoProductionCard({ production }: { production: Production }) {
  const t = useMessages(videoMessages);
  const [confirm, setConfirm] = useState(false);
  const { description, references, seconds, startedAt, progress } = production.draft;
  const assetIds = references.flatMap(({ assetId }) => (assetId ? [assetId] : []));
  return (
    <article
      id={videoProductionCardId}
      className="generation-job video-history-card"
      aria-label={t.productionCard}
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
              {t.abandon}
            </Button>
          </div>
        )}
      </header>
      <div className="history-prompt">
        {description && <VideoHistoryPrompt text={description} />}
        {assetIds.length === references.length ? (
          <ReferenceThumbnails ids={assetIds} label={t.videoReferences} />
        ) : (
          // 仍在上传，只有本地预览可用。
          <section className="generation-output-thumbnails" aria-label={t.videoReferences}>
            {references.map(({ id, src, thumbnailSrc }, index) => (
              <span className="generation-output-thumbnail" key={id}>
                <img src={thumbnailSrc ?? src} alt={t.referenceThumbnail(index + 1)} />
              </span>
            ))}
          </section>
        )}
      </div>
      <VideoProductionProgress production={production} task={undefined} />
      <ConfirmDialog
        isOpen={confirm}
        title={t.abandonTitle}
        content={progress.batchId ? t.abandonCharged : t.abandonFree}
        confirmLabel={t.abandon}
        cancelLabel={t.keep}
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
