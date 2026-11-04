import { Skeleton, Spinner } from "@heroui/react";
import { storyboardImageLimit, type VideoTask } from "@lycoboai/contracts";
import { IconCheck, IconMovie } from "@tabler/icons-react";
import { UiIcon } from "../../components/ui-icon";
import { AssetImage } from "../generation/asset-image";
import type { useStoryboard } from "./storyboard/use-storyboard";
import { VideoCover } from "./video-cover";
import { VideoDownloadLink } from "./video-task-actions";
import { videoTaskStatus } from "./video-task-card";

export type Production = Pick<
  ReturnType<typeof useStoryboard>,
  "draft" | "busy" | "needsResume" | "failed"
>;
const steps = ["创建分镜画面", "编写视频提示词", "生成视频"];
const frameSlots = Array.from({ length: storyboardImageLimit }, (_, position) => ({
  position,
  id: `shot-${position}`,
}));

function ProductionMedia({
  task,
  paused,
  status,
}: {
  task: VideoTask | undefined;
  paused: boolean;
  status: string;
}) {
  const active = !paused && (!task || task.status === "queued" || task.status === "running");
  return (
    <div className="video-production-media">
      {task?.asset_id && task.delivery ? (
        <VideoCover
          assetId={task.asset_id}
          title={task.public_id}
          ratio={task.input.video.aspectRatio}
          seconds={task.input.video.seconds}
          fixedRatio
        />
      ) : (
        <div className="video-production-placeholder">
          {active ? (
            <Spinner size="md" aria-label="视频处理中" />
          ) : (
            <UiIcon icon={IconMovie} size="illustration" />
          )}
          <span>{status}</span>
        </div>
      )}
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
  const framesReady =
    !!progress.frames?.length &&
    (progress.frameJobStatus === "succeeded" || progress.frameJobStatus === "partially_failed");
  const current =
    progress.acceptedVideoId || progress.optimization?.prompt
      ? 2
      : framesReady || progress.optimization
        ? 1
        : 0;
  const complete = task?.status === "succeeded";
  const paused =
    !progress.acceptedVideoId &&
    (production.failed || (!production.busy && production.needsResume));
  const frames =
    progress.frames ??
    task?.input.video.referenceAssetIds
      .slice(1)
      .map((assetId, position) => ({ position, assetId, title: `分镜 ${position + 1}` })) ??
    [];
  const summary = progress.frames?.map(({ title }) => title).join(" → ");
  const videoState = task ? videoTaskStatus(task) : progress.acceptedVideoId ? "已提交" : "提交中";
  const states = [
    current > 0 ? "已完成" : paused ? "待继续" : "进行中",
    current > 1 ? "已完成" : current === 0 ? "等待中" : paused ? "待继续" : "进行中",
    current < 2 ? "等待中" : paused ? "待继续" : videoState,
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
              <span className="video-production-state" aria-live="polite">
                {states[index]}
              </span>
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
                      ) : current > 0 || paused ? (
                        <span key={id}>画面未就绪</span>
                      ) : (
                        <Skeleton key={id} animationType="none" aria-hidden="true" />
                      );
                    })}
                  </section>
                  {current === 0 && !paused && <p>正在准备参考画面，完成后会逐张显示。</p>}
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
                  <div className="video-production-result">
                    <ProductionMedia
                      task={task}
                      paused={paused}
                      status={paused ? "待继续" : videoState}
                    />
                    {task?.asset_id && task.delivery && (
                      <VideoDownloadLink url={task.delivery.download_url} />
                    )}
                  </div>
                  {(task?.status === "queued" || task?.status === "running") && (
                    <p>可以先继续创作，稍后在历史记录查看成片。</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {paused && <p>可回到创作区查看提示。</p>}
    </section>
  );
}
