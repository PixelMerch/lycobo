import { Button, Spinner, Tooltip } from "@heroui/react";
import type { VideoTask } from "@lycoboai/contracts";
import { IconAspectRatio, IconCopy, IconMovie } from "@tabler/icons-react";
import { useState } from "react";
import { CollapsibleText } from "../../components/collapsible-text";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { UiIcon } from "../../components/ui-icon";
import { copyToClipboard } from "../../lib/clipboard";
import { assetContentUrl } from "../generation/generation-client";
import { ReferenceThumbnails } from "../generation/references/reference-thumbnails";
import { useVideoDraft } from "./video-state";
import { VideoTaskActions } from "./video-task-actions";

const statusText = {
  queued: "排队中",
  running: "生成中",
  succeeded: "已完成",
  failed: "生成失败，积分已退回",
  needs_reconciliation: "结果待核对，请勿重复提交",
};
function taskStatus(task: VideoTask) {
  if (task.status !== "running") return statusText[task.status];
  if (task.provider_status === "paused") return "任务暂停，等待恢复";
  if (task.provider_status === "pending_confirmation") return "结果待确认，请勿重复提交";
  if (task.provider_status === "completed") return "正在保存视频";
  return statusText.running;
}
export function VideoTaskCard({ task, onRestore }: { task: VideoTask; onRestore: () => void }) {
  const [confirmRestore, setConfirmRestore] = useState(false);
  const input = task.input.video;
  const active = task.status === "queued" || task.status === "running";
  const status = taskStatus(task);
  function restore() {
    const references = input.referenceAssetIds.map((id, index) => ({
      id,
      assetId: id,
      name: `图片${index + 1}`,
      src: assetContentUrl(id, true),
    }));
    useVideoDraft.getState().update({
      prompt: input.prompt,
      ratio: input.aspectRatio,
      seconds: input.seconds,
      firstFrame: references[0] ?? null,
      lastFrame: references[1] ?? null,
      extraReferences: references.slice(2),
    });
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
        <dl className="generation-meta" aria-label="视频任务信息">
          <div>
            <dt className="sr-only">功能</dt>
            <dd>
              <span className="model-tag video-history-tag">视频创作</span>
            </dd>
          </div>
          <div>
            <dt className="sr-only">时间</dt>
            <dd>
              <time dateTime={task.created_at}>
                {new Date(task.created_at).toLocaleString("zh-CN")}
              </time>
            </dd>
          </div>
          <div className="generation-task-id-field">
            <dt>任务ID：</dt>
            <dd>
              <Tooltip delay={0}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="generation-task-id"
                  aria-label={`复制任务 ID ${task.public_id}`}
                  onPress={(event) => {
                    if (event.pointerType !== "mouse") void copyToClipboard(task.public_id);
                  }}
                  onDoubleClick={() => void copyToClipboard(task.public_id)}
                >
                  {task.public_id}
                </Button>
                <Tooltip.Content placement="top">双击复制任务 ID</Tooltip.Content>
              </Tooltip>
            </dd>
          </div>
          <div className="generation-meta-ratio">
            <dt className="sr-only">画面比例</dt>
            <UiIcon icon={IconAspectRatio} size="small" />
            <dd>{input.aspectRatio}</dd>
          </div>
          <div>
            <dt className="sr-only">时长</dt>
            <dd>{input.seconds}秒</dd>
          </div>
          <div>
            <dt className="sr-only">清晰度</dt>
            <dd>768p</dd>
          </div>
          <div>
            <dt className="sr-only">参考图</dt>
            <dd>
              {input.referenceAssetIds.length
                ? `${input.referenceAssetIds.length} 张参考图`
                : "纯文字"}
            </dd>
          </div>
        </dl>
        <VideoTaskActions
          task={task}
          onEdit={() => {
            const draft = useVideoDraft.getState();
            if (
              draft.prompt.trim() ||
              draft.firstFrame ||
              draft.lastFrame ||
              draft.extraReferences.length
            )
              setConfirmRestore(true);
            else restore();
          }}
        />
      </header>
      <div className="history-prompt">
        <CollapsibleText
          text={task.prompt}
          id={`video-prompt-${task.id}`}
          className="generation-prompt"
        />
        <Button
          variant="secondary"
          className="copy-prompt"
          onPress={() => void copyToClipboard(task.prompt)}
        >
          <UiIcon icon={IconCopy} size="small" />
          复制提示词
        </Button>
        <ReferenceThumbnails ids={input.referenceAssetIds} label="视频参考图" />
      </div>
      <div className="generation-results" data-count="1">
        <div>
          {task.delivery ? (
            // biome-ignore lint/a11y/useMediaCaption: generated videos have no subtitle-track metadata.
            <video
              controls
              playsInline
              preload="none"
              src={task.delivery.url}
              aria-label={`视频：${task.public_id}`}
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
