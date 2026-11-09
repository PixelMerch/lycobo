import { Button, Disclosure, Spinner, Tooltip } from "@heroui/react";
import type { VideoTask } from "@lycoboai/contracts";
import { IconAspectRatio, IconChevronDown, IconCopy, IconMovie } from "@tabler/icons-react";
import { useState } from "react";
import { CollapsibleText } from "../../../components/collapsible-text";
import { ConfirmDialog } from "../../../components/overlays/confirm-dialog";
import { UiIcon } from "../../../components/ui-icon";
import { copyToClipboard } from "../../../lib/clipboard";
import { assetContentUrl } from "../../generation/generation-client";
import { ReferenceThumbnails } from "../../generation/references/reference-thumbnails";
import { VideoCover } from "../player/video-cover";
import { type Production, VideoProductionProgress } from "../production/video-production-progress";
import { useVideoDraft } from "../video-state";
import { VideoTaskActions } from "./video-task-actions";
import { isVideoTaskActive, videoTaskStatus } from "./video-task-status";

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
  return (
    <dl className="generation-meta" aria-label="视频任务信息">
      <div>
        <dt className="sr-only">功能</dt>
        <dd>
          <span className="model-tag video-history-tag">视频创作</span>
        </dd>
      </div>
      {createdAt && (
        <div>
          <dt className="sr-only">时间</dt>
          <dd>
            <time dateTime={createdAt}>{new Date(createdAt).toLocaleString("zh-CN")}</time>
          </dd>
        </div>
      )}
      {publicId && (
        <div className="generation-task-id-field">
          <dt>任务ID：</dt>
          <dd>
            <Tooltip delay={0}>
              <Button
                variant="ghost"
                size="sm"
                className="generation-task-id"
                aria-label={`复制任务 ID ${publicId}`}
                onPress={(event) => {
                  if (event.pointerType !== "mouse") void copyToClipboard(publicId);
                }}
                onDoubleClick={() => void copyToClipboard(publicId)}
              >
                {publicId}
              </Button>
              <Tooltip.Content placement="top">双击复制任务 ID</Tooltip.Content>
            </Tooltip>
          </dd>
        </div>
      )}
      <div className="generation-meta-ratio">
        <dt className="sr-only">画面比例</dt>
        <UiIcon icon={IconAspectRatio} size="small" />
        <dd>{aspectRatio}</dd>
      </div>
      <div>
        <dt className="sr-only">时长</dt>
        <dd>{seconds}秒</dd>
      </div>
      <div>
        <dt className="sr-only">清晰度</dt>
        <dd>768p</dd>
      </div>
      {referenceCount > 0 && (
        <div>
          <dt className="sr-only">参考图</dt>
          <dd>{referenceCount} 张参考图</dd>
        </div>
      )}
    </dl>
  );
}

function restoreVideoTaskDraft(input: VideoTask["input"]["video"]) {
  const references = input.referenceAssetIds.map((id, index) => ({
    id,
    assetId: id,
    name: `图片${index + 1}`,
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

export function VideoTaskCard({
  task,
  onRestore,
  production,
}: {
  task: VideoTask;
  onRestore: () => void;
  /** Present only while this task is the storyboard run still making its video. */
  production?: Production | undefined;
}) {
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
      aria-label={`视频任务：${task.public_id}`}
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
        <VideoHistoryPrompt text={task.input.storyboard?.description ?? task.prompt} />
        <ReferenceThumbnails
          ids={
            task.input.storyboard
              ? input.referenceAssetIds.slice(0, originalCount)
              : input.referenceAssetIds
          }
          label="视频参考图"
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
        title="载入这次创作？"
        content="当前还有未提交的内容，载入后将替换视频草稿。"
        onCancel={() => setConfirmRestore(false)}
        onConfirm={restore}
      />
    </article>
  );
}

export function VideoHistoryPrompt({
  text,
  copyLabel = "复制提示词",
}: {
  text: string;
  copyLabel?: string;
}) {
  return (
    <>
      <CollapsibleText text={text} className="generation-prompt" />
      <Button
        variant="secondary"
        className="copy-prompt"
        onPress={() => void copyToClipboard(text)}
      >
        <UiIcon icon={IconCopy} size="small" />
        {copyLabel}
      </Button>
    </>
  );
}

function VideoStoryboardDetails({
  task,
  originalCount,
}: {
  task: VideoTask;
  originalCount: number;
}) {
  const input = task.input.video;
  return (
    <Disclosure className="video-history-ai">
      {({ isExpanded }) => (
        <>
          <Disclosure.Heading level={3}>
            <Disclosure.Trigger className="video-history-ai-trigger">
              AI 生成内容
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
                <h4 className="video-history-content-label">AI 生成描述</h4>
                <VideoHistoryPrompt text={task.prompt} copyLabel="复制 AI 描述" />
                <h4 className="video-history-content-label">分镜图片</h4>
                <ReferenceThumbnails
                  ids={input.referenceAssetIds.slice(originalCount)}
                  label="分镜图片"
                  itemLabel="分镜图片"
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
            aria-label={`视频画面：${status}`}
          >
            {active ? (
              <Spinner size="md" aria-label="视频处理中" />
            ) : (
              <UiIcon icon={IconMovie} size="illustration" />
            )}
            <span>{status}</span>
            {active && <small>可以继续创作，完成后会自动更新</small>}
          </section>
        )}
      </div>
    </div>
  );
}
