import { Button, Slider, Spinner, ToggleButton, Tooltip } from "@heroui/react";
import {
  IconMaximize,
  IconMinimize,
  IconMovieOff,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconRotateClockwise,
  IconVolume,
  IconVolumeOff,
} from "@tabler/icons-react";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { UiIcon } from "../../components/ui-icon";
import { AssetImage } from "../generation/asset-image";
import { formatVideoTime, useVideoPlayback } from "./use-video-playback";

const idleDelay = 2500;
const seekStep = 5;
function togglePlayback(video: HTMLVideoElement) {
  if (video.paused || video.ended) void video.play().catch(() => {});
  else video.pause();
}
function toggleFullscreen(frame: HTMLElement) {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  else void frame.requestFullscreen().catch(() => {});
}

/**
 * Preview playback with product controls instead of the browser chrome. The poster is the cached
 * list cover, so the frame has content before the lightweight preview file arrives.
 */
export function VideoPlayer({
  assetId,
  title,
  src,
  unavailable,
  aspect: fallbackAspect,
  seconds,
  onRetry,
}: {
  assetId: string;
  title: string;
  src: string | undefined;
  unavailable: boolean;
  aspect: number;
  seconds: number | undefined;
  onRetry: () => void;
}) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const barToggle = useRef<HTMLButtonElement>(null);
  const playback = useVideoPlayback(video);
  const [attempt, setAttempt] = useState(0);
  const [autoplayed, setAutoplayed] = useState<HTMLVideoElement | null>(null);
  const [posterAspect, setPosterAspect] = useState<number | null>(null);
  const [posterFailed, setPosterFailed] = useState(false);
  const [idle, setIdle] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const press = useRef<{ id: number; x: number; y: number } | null>(null);
  const wake = useCallback(() => {
    setIdle(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdle(true), idleDelay);
  }, []);
  useEffect(
    () => () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    },
    [],
  );
  // Opening the preview is the play request. Browsers that refuse audible autoplay still play muted.
  useEffect(() => {
    if (!video) return;
    let active = true;
    video
      .play()
      .catch(() => {
        if (!active) return;
        video.muted = true;
        return video.play();
      })
      .catch(() => {})
      .finally(() => {
        if (active) setAutoplayed(video);
      });
    return () => {
      active = false;
    };
  }, [video]);
  useEffect(() => {
    if (playback.playing) wake();
  }, [playback.playing, wake]);
  useEffect(() => {
    const sync = () =>
      setFullscreen(!!frame.current && document.fullscreenElement === frame.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  // Player shortcuts apply while focus is in this dialog. Space still activates a focused control,
  // and the arrows still move the focused progress slider.
  useEffect(() => {
    if (!video) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const element = frame.current;
      const target = event.target instanceof Element ? event.target : null;
      const key = event.key.toLowerCase();
      if (
        !element ||
        !target ||
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (event.repeat && key !== "arrowleft" && key !== "arrowright") ||
        !element.closest('[role="dialog"]')?.contains(target)
      )
        return;
      const field = target.closest("input, textarea");
      if ((key === " " && !target.closest("button, a") && !field) || key === "k")
        togglePlayback(video);
      else if ((key === "arrowleft" || key === "arrowright") && !field) {
        const limit = Number.isFinite(video.duration) ? video.duration : video.currentTime;
        const delta = key === "arrowleft" ? -seekStep : seekStep;
        video.currentTime = Math.max(0, Math.min(limit, video.currentTime + delta));
      } else if (key === "m") video.muted = !video.muted;
      else if (key === "f" && document.fullscreenEnabled) toggleFullscreen(element);
      else return;
      event.preventDefault();
      wake();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [video, wake]);
  const failed = unavailable || playback.failed;
  const loading = !failed && (!src || playback.waiting || autoplayed !== video);
  const aspect =
    playback.width && playback.height
      ? playback.width / playback.height
      : (posterAspect ?? fallbackAspect);
  const duration = playback.duration || seconds || 0;
  const frameStyle: CSSProperties & { "--video-aspect": number } = { "--video-aspect": aspect };
  const controlsHidden = playback.playing && idle;
  return (
    <div
      ref={frame}
      className="video-preview-frame"
      style={frameStyle}
      data-controls={controlsHidden ? "hidden" : "visible"}
      onPointerMove={wake}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse" && playback.playing) setIdle(true);
      }}
    >
      {src && !unavailable && (
        // biome-ignore lint/a11y/useMediaCaption: generated videos have no subtitle-track metadata.
        <video
          key={`${src}#${attempt}`}
          ref={setVideo}
          className="video-preview-media"
          src={src}
          playsInline
          preload="auto"
          controlsList="nodownload"
          aria-label={`视频：${title}`}
        />
      )}
      {!posterFailed && (
        <AssetImage
          assetId={assetId}
          thumbnail
          alt=""
          className="video-preview-poster"
          data-hidden={playback.ready || undefined}
          onLoad={(event) =>
            setPosterAspect(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight)
          }
          onError={() => setPosterFailed(true)}
        />
      )}
      {/* Pointer shortcut only; keyboard users have the play button and the Space key. */}
      <div
        className="video-preview-surface"
        aria-hidden="true"
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          press.current =
            event.button === 0 ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
        }}
        onPointerUp={(event) => {
          const start = press.current;
          press.current = null;
          if (
            video &&
            !failed &&
            start?.id === event.pointerId &&
            Math.hypot(event.clientX - start.x, event.clientY - start.y) < 6
          ) {
            togglePlayback(video);
            wake();
          }
        }}
        onPointerCancel={() => {
          press.current = null;
        }}
      />
      <div className="video-preview-center">
        {failed ? (
          <div className="video-preview-error">
            <UiIcon icon={IconMovieOff} size="illustration" />
            <p>视频暂时无法播放</p>
            <Button
              size="sm"
              variant="ghost"
              className="video-preview-retry"
              onPress={() => {
                setAttempt((value) => value + 1);
                onRetry();
              }}
            >
              重新加载
            </Button>
          </div>
        ) : loading ? (
          <span className="video-preview-loading">
            <Spinner size="md" color="current" aria-label="正在加载视频" />
          </span>
        ) : (
          !playback.playing &&
          video && (
            <Button
              isIconOnly
              variant="ghost"
              className="video-preview-play"
              data-replay={playback.ended || undefined}
              aria-label={playback.ended ? "重新播放" : "播放视频"}
              onPress={(event) => {
                togglePlayback(video);
                // This button leaves once playback starts; keep keyboard focus on the bar toggle.
                if (event.pointerType === "keyboard" || event.pointerType === "virtual")
                  barToggle.current?.focus();
              }}
            >
              <UiIcon
                icon={playback.ended ? IconRotateClockwise : IconPlayerPlayFilled}
                size="illustration"
              />
            </Button>
          )
        )}
      </div>
      {!failed && (
        <div className="video-preview-controls">
          <Slider
            className="video-preview-progress"
            aria-label="播放进度"
            minValue={0}
            maxValue={duration || 1}
            step={0.1}
            value={Math.min(playback.currentTime, duration || 1)}
            formatOptions={{ style: "unit", unit: "second", maximumFractionDigits: 0 }}
            isDisabled={!video || !playback.duration}
            onChange={(value) => {
              const next = Array.isArray(value) ? value[0] : value;
              if (video && next !== undefined) video.currentTime = next;
              wake();
            }}
          >
            <Slider.Track>
              <Slider.Fill />
              <Slider.Thumb />
            </Slider.Track>
          </Slider>
          <div className="video-preview-bar">
            <Tooltip delay={0}>
              <Button
                ref={barToggle}
                isIconOnly
                variant="ghost"
                className="video-preview-control"
                aria-label={playback.playing ? "暂停" : "播放"}
                isDisabled={!video}
                onPress={() => video && togglePlayback(video)}
              >
                <UiIcon
                  icon={playback.playing ? IconPlayerPauseFilled : IconPlayerPlayFilled}
                  size="navigation"
                />
              </Button>
              <Tooltip.Content placement="top">
                {playback.playing ? "暂停" : "播放"}
              </Tooltip.Content>
            </Tooltip>
            <span className="video-preview-time">
              {formatVideoTime(playback.currentTime)}
              {duration > 0 && ` / ${formatVideoTime(duration)}`}
            </span>
            <span className="video-preview-spacer" />
            <Tooltip delay={0}>
              <ToggleButton
                isIconOnly
                variant="ghost"
                className="video-preview-control"
                aria-label="静音"
                isSelected={playback.muted}
                isDisabled={!video}
                onChange={(muted) => {
                  if (video) video.muted = muted;
                }}
              >
                <UiIcon icon={playback.muted ? IconVolumeOff : IconVolume} size="navigation" />
              </ToggleButton>
              <Tooltip.Content placement="top">
                {playback.muted ? "取消静音" : "静音"}
              </Tooltip.Content>
            </Tooltip>
            {document.fullscreenEnabled && (
              <Tooltip delay={0}>
                <Button
                  isIconOnly
                  variant="ghost"
                  className="video-preview-control"
                  aria-label={fullscreen ? "退出全屏" : "全屏播放"}
                  onPress={() => frame.current && toggleFullscreen(frame.current)}
                >
                  <UiIcon icon={fullscreen ? IconMinimize : IconMaximize} size="navigation" />
                </Button>
                <Tooltip.Content placement="top">
                  {fullscreen ? "退出全屏" : "全屏播放"}
                </Tooltip.Content>
              </Tooltip>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
