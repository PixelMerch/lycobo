import { Button, Skeleton, Spinner } from "@heroui/react";
import { imageUnitCredits, storyboardImageLimit, type VideoTask } from "@lycoboai/contracts";
import { IconCheck, IconMovie } from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import { AssetImage } from "../../generation/asset-image";
import { videoTaskStatus } from "../history/video-task-status";
import type { useStoryboard } from "../storyboard/use-storyboard";

export type Production = Pick<
  ReturnType<typeof useStoryboard>,
  | "draft"
  | "busy"
  | "needsResume"
  | "canAbandon"
  | "abandon"
  | "pendingVideo"
  | "waitingForFrames"
  | "resumingFrames"
  | "checkingFrames"
  | "canRetryFrame"
  | "retryFrame"
  | "blocked"
  | "remainingCost"
  | "resume"
>;
const steps = ["创建分镜画面", "编写视频提示词", "生成视频"];
const frameSlots = Array.from({ length: storyboardImageLimit }, (_, position) => ({
  position,
  id: `shot-${position}`,
}));

function ProductionMedia({ executing, status }: { executing: boolean; status: string }) {
  return (
    <div className="video-production-media">
      <div className="video-production-placeholder">
        {executing ? (
          <Spinner size="sm" color="current" aria-hidden="true" />
        ) : (
          <UiIcon icon={IconMovie} size="illustration" />
        )}
        <span>{status}</span>
      </div>
    </div>
  );
}

function frameMedia(production: Production, task: VideoTask | undefined) {
  const { progress } = production.draft;
  const executing = progress.acceptedVideoId
    ? task?.status === "running" &&
      task.provider_status !== "paused" &&
      task.provider_status !== "pending_confirmation"
    : production.busy;
  const frames =
    progress.frames ??
    task?.input.video.referenceAssetIds
      .slice(task.input.storyboardOriginalImageCount ?? 1)
      .map((assetId, position) => ({ position, assetId, title: `分镜 ${position + 1}` })) ??
    [];
  return { executing, frames };
}

function productionLabels(
  production: Production,
  task: VideoTask | undefined,
  current: number,
  paused: boolean,
  waitingForFrames: boolean,
) {
  const { progress } = production.draft;
  const pausedState = production.pendingVideo ? "待确认" : "待继续";
  const summary = progress.frames?.map(({ title }) => title).join(" → ");
  const submittedState = progress.acceptedVideoId ? "已提交" : "提交中";
  const videoState = task ? videoTaskStatus(task) : submittedState;
  const mediaStatus = paused ? pausedState : videoState;
  const motionStatus = paused ? "等待继续整理镜头。" : "正在安排镜头顺序和运镜。";
  const promptStatus = current > 1 ? summary || "镜头顺序与运镜已整理。" : motionStatus;
  const runningState = paused ? "待继续" : "进行中";
  const waitingState = production.checkingFrames ? "待确认" : "待补齐";
  const frameState = waitingForFrames ? waitingState : runningState;
  const scriptState = current === 0 ? "等待中" : runningState;
  const states = [
    current > 0 ? "已完成" : frameState,
    current > 1 ? "已完成" : scriptState,
    current < 2 ? "等待中" : mediaStatus,
  ];
  return { states, promptStatus, mediaStatus };
}

function productionProgressView(production: Production, task: VideoTask | undefined) {
  const { progress, count } = production.draft;
  const framesReady = progress.frames?.length === count && progress.frameJobStatus === "succeeded";
  const nextFrameStage = framesReady ? 1 : 0;
  const current =
    progress.acceptedVideoId || (framesReady && progress.optimization?.prompt) ? 2 : nextFrameStage;
  // Shown only while unfinished, so an idle run has stopped and waits for the user.
  const paused = !progress.acceptedVideoId && !production.busy;
  const { executing, frames } = frameMedia(production, task);
  const waitingForFrames = current === 0 && production.waitingForFrames && !production.busy;
  const checkFrames = production.resumingFrames || production.checkingFrames;
  const canResume = paused && (!waitingForFrames || checkFrames);
  const continueLabel =
    production.pendingVideo && current === 2 ? "待确认" : `继续生成 · ${production.remainingCost}`;
  const resumeLabel = checkFrames ? "检查分镜状态" : continueLabel;
  const retryable = (position: number) =>
    progress.failedFramePositions?.includes(position) ??
    (progress.frameJobStatus === "failed" || progress.frameJobStatus === "partially_failed");
  const labels = productionLabels(production, task, current, paused, waitingForFrames);
  return {
    current,
    count,
    paused,
    executing,
    frames,
    waitingForFrames,
    checkFrames,
    canResume,
    resumeLabel,
    retryable,
    ...labels,
  };
}

export function VideoProductionProgress({
  production,
  task,
}: {
  production: Production;
  task: VideoTask | undefined;
}) {
  const view = productionProgressView(production, task);
  const { current, canResume, resumeLabel, executing, states } = view;
  return (
    <section className="video-production-progress" aria-label="视频制作进度">
      <ol>
        {steps.map((title, index) => {
          const done = index < current;
          return (
            <li key={title} aria-current={index === current && !done ? "step" : undefined}>
              <span className="video-production-step" aria-hidden="true">
                {done ? <UiIcon icon={IconCheck} size="small" /> : index + 1}
              </span>
              <span>{title}</span>
              {index === current && canResume ? (
                <Button
                  className="video-production-state video-production-state-action"
                  size="sm"
                  variant="ghost"
                  isDisabled={production.blocked}
                  onPress={production.resume}
                >
                  {resumeLabel}
                </Button>
              ) : (
                <span
                  className="video-production-state"
                  data-executing={(index === current && executing) || undefined}
                  aria-live="polite"
                >
                  {states[index]}
                </span>
              )}
              {index === 0 && <ProductionFrames production={production} view={view} />}
              {index === 1 && current > 0 && (
                <p className="video-production-detail">{view.promptStatus}</p>
              )}
              {index === 2 && current === 2 && (
                <div className="video-production-detail">
                  <ProductionMedia executing={executing} status={view.mediaStatus} />
                  {(task?.status === "queued" || task?.status === "running") && (
                    <p>可以先继续创作，成片完成后会显示在这里。</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

type ProductionView = ReturnType<typeof productionProgressView>;

function ProductionFrames({ production, view }: { production: Production; view: ProductionView }) {
  const { count, current, paused, waitingForFrames, checkFrames, frames } = view;
  return (
    <div className="video-production-detail">
      <section className="video-production-frames" aria-label="分镜画面">
        {frameSlots.slice(0, count).map(({ id, position }) => {
          return (
            <ProductionFrame key={id} position={position} production={production} view={view} />
          );
        })}
      </section>
      {current === 0 && !paused && <p>正在准备参考画面，完成后会逐张显示。</p>}
      {current === 0 && paused && !waitingForFrames && (
        <p>
          {checkFrames
            ? "分镜可能已经生成，可检查最新状态。"
            : "参考画面还没有开始生成，可继续制作。"}
        </p>
      )}
      {waitingForFrames && (
        <p>
          已生成 {frames.length}/{count} 张分镜。
          {production.checkingFrames
            ? "可重新检查分镜状态。"
            : `可重试未生成的画面，每张 ${imageUnitCredits} 积分，全部生成后自动进入下一步。`}
        </p>
      )}
    </div>
  );
}

function ProductionFrame({
  position,
  production,
  view,
}: {
  position: number;
  production: Production;
  view: ProductionView;
}) {
  const { frames, waitingForFrames, retryable, current, paused, executing } = view;
  const frame = frames.find((item) => item.position === position);
  if (frame)
    return <AssetImage assetId={frame.assetId} thumbnail alt={frame.title} loading="lazy" />;
  if (waitingForFrames && retryable(position))
    return (
      <Button
        className="video-production-frame-retry"
        size="sm"
        variant="ghost"
        aria-label={`重试第 ${position + 1} 张分镜，${imageUnitCredits} 积分`}
        isDisabled={!production.canRetryFrame}
        onPress={() => production.retryFrame(position)}
      >
        <span>画面未生成</span>
        <span>重试</span>
      </Button>
    );
  if (current > 0 || paused) return <span>{waitingForFrames ? "画面待确认" : "画面未就绪"}</span>;
  return <Skeleton animationType={executing ? "shimmer" : "none"} aria-hidden="true" />;
}
