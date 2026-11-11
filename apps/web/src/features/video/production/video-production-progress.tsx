import { Button, Skeleton, Spinner } from "@heroui/react";
import { imageUnitCredits, storyboardImageLimit, type VideoTask } from "@lycoboai/contracts";
import { IconCheck, IconMovie } from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import type { Locale } from "../../../i18n/locale";
import { useMessages } from "../../../i18n/messages";
import { AssetImage } from "../../generation/asset-image";
import { videoTaskStatus } from "../history/video-task-status";
import type { useStoryboard } from "../storyboard/use-storyboard";
import { videoMessages } from "../video-messages";

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
type VideoText = (typeof videoMessages)[Locale];
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

function frameMedia(production: Production, task: VideoTask | undefined, t: VideoText) {
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
      .map((assetId, position) => ({ position, assetId, title: t.shot(position + 1) })) ??
    [];
  return { executing, frames };
}

function productionLabels(
  production: Production,
  task: VideoTask | undefined,
  current: number,
  paused: boolean,
  waitingForFrames: boolean,
  t: VideoText,
) {
  const { progress } = production.draft;
  const pausedState = production.pendingVideo ? t.toConfirm : t.toContinue;
  const summary = progress.frames?.map(({ title }) => title).join(" → ");
  const submittedState = progress.acceptedVideoId ? t.submitted : t.submittingState;
  const videoState = task ? videoTaskStatus(task) : submittedState;
  const mediaStatus = paused ? pausedState : videoState;
  const motionStatus = paused ? t.waitingShots : t.arrangingShots;
  const promptStatus = current > 1 ? summary || t.shotsArranged : motionStatus;
  const runningState = paused ? t.toContinue : t.inProgress;
  const waitingState = production.checkingFrames ? t.toConfirm : t.toFill;
  const frameState = waitingForFrames ? waitingState : runningState;
  const scriptState = current === 0 ? t.waiting : runningState;
  const states = [
    current > 0 ? t.done : frameState,
    current > 1 ? t.done : scriptState,
    current < 2 ? t.waiting : mediaStatus,
  ];
  return { states, promptStatus, mediaStatus };
}

function productionProgressView(production: Production, task: VideoTask | undefined, t: VideoText) {
  const { progress, count } = production.draft;
  const framesReady = progress.frames?.length === count && progress.frameJobStatus === "succeeded";
  const nextFrameStage = framesReady ? 1 : 0;
  const current =
    progress.acceptedVideoId || (framesReady && progress.optimization?.prompt) ? 2 : nextFrameStage;
  // 只在未完成时显示，所以空闲的制作意味着已停下、等待用户继续。
  const paused = !progress.acceptedVideoId && !production.busy;
  const { executing, frames } = frameMedia(production, task, t);
  const waitingForFrames = current === 0 && production.waitingForFrames && !production.busy;
  const checkFrames = production.resumingFrames || production.checkingFrames;
  const canResume = paused && (!waitingForFrames || checkFrames);
  const continueLabel =
    production.pendingVideo && current === 2
      ? t.toConfirm
      : t.continueCost(production.remainingCost);
  const resumeLabel = checkFrames ? t.checkShots : continueLabel;
  const retryable = (position: number) =>
    progress.failedFramePositions?.includes(position) ??
    (progress.frameJobStatus === "failed" || progress.frameJobStatus === "partially_failed");
  const labels = productionLabels(production, task, current, paused, waitingForFrames, t);
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

/** 视频制作进度：分镜画面、视频提示词与成片三个步骤。 */
export function VideoProductionProgress({
  production,
  task,
}: {
  production: Production;
  task: VideoTask | undefined;
}) {
  const t = useMessages(videoMessages);
  const view = productionProgressView(production, task, t);
  const { current, canResume, resumeLabel, executing, states } = view;
  return (
    <section className="video-production-progress" aria-label={t.progress}>
      <ol>
        {t.steps.map((title, index) => {
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
                    <p>{t.keepCreating}</p>
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
  const t = useMessages(videoMessages);
  return (
    <div className="video-production-detail">
      <section className="video-production-frames" aria-label={t.frames}>
        {frameSlots.slice(0, count).map(({ id, position }) => {
          return (
            <ProductionFrame key={id} position={position} production={production} view={view} />
          );
        })}
      </section>
      {current === 0 && !paused && <p>{t.preparingFrames}</p>}
      {current === 0 && paused && !waitingForFrames && (
        <p>{checkFrames ? t.framesMayExist : t.framesNotStarted}</p>
      )}
      {waitingForFrames && (
        <p>
          {t.framesReady(frames.length, count)}
          {production.checkingFrames ? t.recheckFrames : t.retryFrames(imageUnitCredits)}
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
  const t = useMessages(videoMessages);
  if (frame)
    return <AssetImage assetId={frame.assetId} thumbnail alt={frame.title} loading="lazy" />;
  if (waitingForFrames && retryable(position))
    return (
      <Button
        className="video-production-frame-retry"
        size="sm"
        variant="ghost"
        aria-label={t.retryFrame(position + 1, imageUnitCredits)}
        isDisabled={!production.canRetryFrame}
        onPress={() => production.retryFrame(position)}
      >
        <span>{t.frameMissing}</span>
        <span>{t.retry}</span>
      </Button>
    );
  if (current > 0 || paused)
    return <span>{waitingForFrames ? t.frameToConfirm : t.frameNotReady}</span>;
  return <Skeleton animationType={executing ? "shimmer" : "none"} aria-hidden="true" />;
}
