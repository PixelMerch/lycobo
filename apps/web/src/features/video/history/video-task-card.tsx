import { Button, Disclosure, Spinner, Tooltip } from "@heroui/react";
import type { VideoTask } from "@lycoboai/contracts";
import { IconAspectRatio, IconChevronDown, IconMovie } from "@tabler/icons-react";
import { useState } from "react";
import { ConfirmDialog } from "../../../components/overlays/confirm-dialog";
import { UiIcon } from "../../../components/ui-icon";
import { useLocale } from "../../../i18n/locale-store";
import { currentMessages, useMessages } from "../../../i18n/messages";
import { copyToClipboard } from "../../../lib/clipboard";
import { assetContentUrl } from "../../generation/generation-client";
import { HistoryPromptContent } from "../../generation/history/history-prompt-content";
import { ReferenceThumbnails } from "../../generation/references/reference-thumbnails";
import { VideoCover } from "../player/video-cover";
import { type Production, VideoProductionProgress } from "../production/video-production-progress";
import { useVideoDraft } from "../video-state";
import { videoHistoryMessages } from "./video-history-messages";
import { VideoTaskActions } from "./video-task-actions";
import { isVideoTaskActive, videoTaskStatus } from "./video-task-status";

/** 视频任务的信息行：功能、时间、任务 ID、比例、时长、清晰度与参考图数。 */
export function VideoHistoryMeta({
  createdAt,
  publicId,
  aspectRatio,
  seconds,
  referenceCount,
}: {
  createdAt?: string | undefined;
  publicId?: string;
  aspectRatio: string;
  seconds: number;
  referenceCount: number;
}) {
  const locale = useLocale();
  const t = useMessages(videoHistoryMessages);
  return (
    <dl className="generation-meta" aria-label={t.taskInfo}>
      <div>
        <dt className="sr-only">{t.tool}</dt>
        <dd>
          <span className="model-tag video-history-tag">{t.videoTool}</span>
        </dd>
      </div>
      {createdAt && (
        <div>
          <dt className="sr-only">{t.time}</dt>
          <dd>
            <time dateTime={createdAt}>{new Date(createdAt).toLocaleString(locale)}</time>
          </dd>
        </div>
      )}
      {publicId && (
        <div className="generation-task-id-field">
          <dt>{t.taskId}</dt>
          <dd>
            <Tooltip delay={0}>
              <Button
                variant="ghost"
                size="sm"
                className="generation-task-id"
                aria-label={t.copyTaskId(publicId)}
                onPress={(event) => {
                  if (event.pointerType !== "mouse") void copyToClipboard(publicId);
                }}
                onDoubleClick={() => void copyToClipboard(publicId)}
              >
                {publicId}
              </Button>
              <Tooltip.Content placement="top">{t.doubleClickToCopy}</Tooltip.Content>
            </Tooltip>
          </dd>
        </div>
      )}
      <div className="generation-meta-ratio">
        <dt className="sr-only">{t.aspectRatio}</dt>
        <UiIcon icon={IconAspectRatio} size="small" />
        <dd>{aspectRatio}</dd>
      </div>
      <div>
        <dt className="sr-only">{t.duration}</dt>
        <dd>{t.seconds(seconds)}</dd>
      </div>
      <div>
        <dt className="sr-only">{t.clarity}</dt>
        <dd>768p</dd>
      </div>
      {referenceCount > 0 && (
        <div>
          <dt className="sr-only">{t.references}</dt>
          <dd>{t.referenceCount(referenceCount)}</dd>
        </div>
      )}
    </dl>
  );
}

function restoreVideoTaskDraft(input: VideoTask["input"]["video"]) {
  const references = input.referenceAssetIds.map((id, index) => ({
    id,
    assetId: id,
    name: currentMessages(videoHistoryMessages).imageName(index + 1),
    src: assetContentUrl(id, true),
  }));
  useVideoDraft.getState().update({
    reuseReferences: true,
    prompt: input.prompt,
    ratio: input.aspectRatio,
    seconds: input.seconds,
    firstFrame: references[0] ?? null,
    lastFrame: references[1] ?? null,
    extraReferences: references.slice(2),
  });
}

/** 一条视频历史：信息、提示词、参考图与成片或制作进度。 */
export function VideoTaskCard({
  task,
  onRestore,
  production,
}: {
  task: VideoTask;
  onRestore: () => void;
  /** 只在这个任务是仍在制作视频的分镜流程时传入。 */
  production?: Production | undefined;
}) {
  const t = useMessages(videoHistoryMessages);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const input = task.input.video;
  const originalCount = task.input.storyboardOriginalImageCount ?? 1;
  function restore() {
    restoreVideoTaskDraft(input);
    setConfirmRestore(false);
    onRestore();
  }
  return (
    <article
      id={`video-task-${task.id}`}
      className="generation-job video-history-card"
      aria-label={t.task(task.public_id)}
    >
      <header className="video-history-header">
        <VideoHistoryMeta
          createdAt={task.created_at}
          publicId={task.public_id}
          aspectRatio={input.aspectRatio}
          seconds={input.seconds}
          referenceCount={task.input.storyboard ? originalCount : input.referenceAssetIds.length}
        />
        <VideoTaskActions
          task={task}
          onEdit={() => {
            if (hasVideoDraft()) setConfirmRestore(true);
            else restore();
          }}
        />
      </header>
      <div className="history-prompt">
        <HistoryPromptContent text={task.input.storyboard?.description ?? task.prompt} />
        <ReferenceThumbnails
          ids={
            task.input.storyboard
              ? input.referenceAssetIds.slice(0, originalCount)
              : input.referenceAssetIds
          }
          label={t.videoReferences}
        />
        {task.input.storyboard && (
          <VideoStoryboardDetails task={task} originalCount={originalCount} />
        )}
      </div>
      {production ? (
        <VideoProductionProgress production={production} task={task} />
      ) : (
        <VideoTaskResult task={task} />
      )}
      <ConfirmDialog
        isOpen={confirmRestore}
        title={t.restoreTitle}
        content={t.restoreContent}
        onCancel={() => setConfirmRestore(false)}
        onConfirm={restore}
      />
    </article>
  );
}

function VideoStoryboardDetails({
  task,
  originalCount,
}: {
  task: VideoTask;
  originalCount: number;
}) {
  const t = useMessages(videoHistoryMessages);
  const input = task.input.video;
  return (
    <Disclosure className="video-history-ai">
      {({ isExpanded }) => (
        <>
          <Disclosure.Heading level={3}>
            <Disclosure.Trigger className="video-history-ai-trigger">
              {t.aiContent}
              <Disclosure.Indicator>
                <span>
                  <UiIcon icon={IconChevronDown} size="small" />
                </span>
              </Disclosure.Indicator>
            </Disclosure.Trigger>
          </Disclosure.Heading>
          <Disclosure.Content>
            {isExpanded && (
              <Disclosure.Body className="history-prompt">
                <h4 className="video-history-content-label">{t.aiDescription}</h4>
                <HistoryPromptContent text={task.prompt} copyLabel={t.copyAiDescription} />
                <h4 className="video-history-content-label">{t.storyboardImages}</h4>
                <ReferenceThumbnails
                  ids={input.referenceAssetIds.slice(originalCount)}
                  label={t.storyboardImages}
                  itemLabel={t.storyboardImages}
                />
              </Disclosure.Body>
            )}
          </Disclosure.Content>
        </>
      )}
    </Disclosure>
  );
}

function hasVideoDraft() {
  const draft = useVideoDraft.getState();
  return !!(
    draft.prompt.trim() ||
    draft.firstFrame ||
    draft.lastFrame ||
    draft.extraReferences.length
  );
}

function VideoTaskResult({ task }: { task: VideoTask }) {
  const t = useMessages(videoHistoryMessages);
  const input = task.input.video;
  const active = isVideoTaskActive(task);
  const status = videoTaskStatus(task);
  return (
    <div className="generation-results" data-count="1">
      <div>
        {task.delivery && task.asset_id ? (
          <VideoCover
            assetId={task.asset_id}
            title={task.public_id}
            ratio={input.aspectRatio}
            seconds={input.seconds}
          />
        ) : (
          <section
            className={`video-history-placeholder${active ? " generation-pending" : ""}`}
            aria-label={t.videoFrame(status)}
          >
            {active ? (
              <Spinner size="md" aria-label={t.processing} />
            ) : (
              <UiIcon icon={IconMovie} size="illustration" />
            )}
            <span>{status}</span>
            {active && <small>{t.keepCreating}</small>}
          </section>
        )}
      </div>
    </div>
  );
}
