import { Button, Skeleton, Spinner } from "@heroui/react";
import { imageUnitCredits, storyboardImageLimit, type VideoTask } from "@lycoboai/contracts";
import { IconCheck, IconMovie } from "@tabler/icons-react";
import { UiIcon } from "../../components/ui-icon";
import { AssetImage } from "../generation/asset-image";
import type { useStoryboard } from "./storyboard/use-storyboard";
import { videoTaskStatus } from "./video-task-card";

export type Production = Pick<
  ReturnType<typeof useStoryboard>,
  | "draft"
  | "busy"
  | "needsResume"
  | "failed"
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

export function VideoProductionProgress({
  production,
  task,
}: {
  production: Production;
  task: VideoTask | undefined;
}) {
  const { progress, count } = production.draft;
  const framesReady = progress.frames?.length === count && progress.frameJobStatus === "succeeded";
  const current =
    progress.acceptedVideoId || (framesReady && progress.optimization?.prompt)
      ? 2
      : framesReady
        ? 1
        : 0;
  const complete = task?.status === "succeeded";
  const paused =
    !progress.acceptedVideoId &&
    (production.failed || (!production.busy && production.needsResume));
  const pausedState = production.pendingVideo ? "待确认" : "待继续";
  const executing =
    !paused &&
    (current < 2 || !progress.acceptedVideoId
      ? production.busy
      : task?.status === "running" &&
        task.provider_status !== "paused" &&
        task.provider_status !== "pending_confirmation");
  const frames =
    progress.frames ??
    task?.input.video.referenceAssetIds
      .slice(task.input.storyboardOriginalImageCount ?? 1)
      .map((assetId, position) => ({ position, assetId, title: `分镜 ${position + 1}` })) ??
    [];
  const summary = progress.frames?.map(({ title }) => title).join(" → ");
  const waitingForFrames = current === 0 && production.waitingForFrames && !production.busy;
  const checkFrames = production.resumingFrames || production.checkingFrames;
  const canResume = paused && production.needsResume && (!waitingForFrames || checkFrames);
  const resumeLabel = checkFrames
    ? "检查分镜状态"
    : production.pendingVideo && current === 2
      ? "待确认"
      : `继续生成 · ${production.remainingCost}`;
  const retryable = (position: number) =>
    progress.failedFramePositions?.includes(position) ??
    (progress.frameJobStatus === "failed" || progress.frameJobStatus === "partially_failed");
  const videoState = task ? videoTaskStatus(task) : progress.acceptedVideoId ? "已提交" : "提交中";
  const states = [
    current > 0
      ? "已完成"
      : waitingForFrames
        ? production.checkingFrames
          ? "待确认"
          : "待补齐"
        : paused
          ? "待继续"
          : "进行中",
    current > 1 ? "已完成" : current === 0 ? "等待中" : paused ? "待继续" : "进行中",
    current < 2 ? "等待中" : paused ? pausedState : videoState,
  ];
  return (
    <section
      className="video-production-progress"
      id={task ? `video-production-${task.id}` : undefined}
      aria-label="视频制作进度"
    >
      <h2>视频制作进度</h2>
      <ol>
        {steps.map((title, index) => {
          const done = complete || index < current;
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
              {index === 0 && (
                <div className="video-production-detail">
                  <section className="video-production-frames" aria-label="分镜画面">
                    {frameSlots.slice(0, count).map(({ id, position }) => {
                      const frame = frames.find((item) => item.position === position);
                      return frame ? (
                        <AssetImage
                          key={id}
                          assetId={frame.assetId}
                          thumbnail
                          alt={frame.title}
                          loading="lazy"
                        />
                      ) : waitingForFrames && retryable(position) ? (
                        <Button
                          key={id}
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
                      ) : current > 0 || paused ? (
                        <span key={id}>{waitingForFrames ? "画面待确认" : "画面未就绪"}</span>
                      ) : (
                        <Skeleton
                          key={id}
                          animationType={executing ? "shimmer" : "none"}
                          aria-hidden="true"
                        />
                      );
                    })}
                  </section>
                  {current === 0 && !paused && <p>正在准备参考画面，完成后会逐张显示。</p>}
                  {waitingForFrames && (
                    <p>
                      已生成 {frames.length}/{count} 张分镜。
                      {production.checkingFrames
                        ? "可重新检查分镜状态。"
                        : `可重试未生成的画面，每张 ${imageUnitCredits} 积分，全部生成后自动进入下一步。`}
                    </p>
                  )}
                </div>
              )}
              {index === 1 && current > 0 && (
                <p className="video-production-detail">
                  {current > 1
                    ? summary || "镜头顺序与运镜已整理。"
                    : paused
                      ? "等待继续整理镜头。"
                      : "正在安排镜头顺序和运镜。"}
                </p>
              )}
              {index === 2 && current === 2 && (
                <div className="video-production-detail">
                  <ProductionMedia
                    executing={executing}
                    status={paused ? pausedState : videoState}
                  />
                  {(task?.status === "queued" || task?.status === "running") && (
                    <p>可以先继续创作，稍后在历史记录查看成片。</p>
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
