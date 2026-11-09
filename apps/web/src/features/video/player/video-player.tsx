import { Button, Spinner } from "@heroui/react";
import { IconMovieOff, IconPlayerPlayFilled, IconRotateClockwise } from "@tabler/icons-react";
import {
  type CSSProperties,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { UiIcon } from "../../../components/ui-icon";
import { AssetImage } from "../../generation/asset-image";
import { canSeek, useVideoPlayback } from "./use-video-playback";
import { toggleFullscreen, togglePlayback, VideoPlaybackControls } from "./video-playback-controls";

const idleDelay = 2500;
const seekStep = 5;
type Playback = ReturnType<typeof useVideoPlayback>;

function useMutedAutoplay(video: HTMLVideoElement | null) {
  const [autoplayed, setAutoplayed] = useState<HTMLVideoElement | null>(null);
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
      .catch(() => undefined)
      .finally(() => {
        if (active) setAutoplayed(video);
      });
    return () => {
      active = false;
    };
  }, [video]);
  return autoplayed;
}

function canUseShortcut(event: KeyboardEvent, element: HTMLElement, target: Element, key: string) {
  if (
    event.defaultPrevented ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    (event.repeat && key !== "arrowleft" && key !== "arrowright") ||
    !element.closest('[role="dialog"]')?.contains(target)
  )
    return false;
  return true;
}

function applyPlaybackShortcut(
  video: HTMLVideoElement,
  element: HTMLElement,
  target: Element,
  key: string,
) {
  const field = target.closest("input, textarea");
  if ((key === " " && !target.closest("button, a") && !field) || key === "k") togglePlayback(video);
  else if ((key === "arrowleft" || key === "arrowright") && !field && canSeek(video)) {
    const limit = Number.isFinite(video.duration) ? video.duration : video.currentTime;
    const delta = key === "arrowleft" ? -seekStep : seekStep;
    video.currentTime = Math.max(0, Math.min(limit, video.currentTime + delta));
  } else if (key === "m") video.muted = !video.muted;
  else if (key === "f" && document.fullscreenEnabled) toggleFullscreen(element);
  else return false;
  return true;
}

function usePlaybackShortcuts(
  video: HTMLVideoElement | null,
  frame: RefObject<HTMLDivElement | null>,
  wake: () => void,
) {
  // Player shortcuts apply while focus is in this dialog. Space still activates a focused control,
  // and the arrows still move the focused progress slider.
  useEffect(() => {
    if (!video) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const element = frame.current;
      const target = event.target instanceof Element ? event.target : null;
      const key = event.key.toLowerCase();
      if (!element || !target || !canUseShortcut(event, element, target, key)) return;
      if (!applyPlaybackShortcut(video, element, target, key)) return;
      event.preventDefault();
      wake();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [video, frame, wake]);
}

/**
 * Preview playback with product controls instead of the browser chrome. The poster is the cached
 * list cover, so the frame has content while the original video buffers.
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
  const autoplayed = useMutedAutoplay(video);
  const [posterAspect, setPosterAspect] = useState<number | null>(null);
  const [posterFailed, setPosterFailed] = useState(false);
  const [idle, setIdle] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  useEffect(() => {
    if (playback.playing) wake();
  }, [playback.playing, wake]);
  useEffect(() => {
    const sync = () =>
      setFullscreen(!!frame.current && document.fullscreenElement === frame.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  usePlaybackShortcuts(video, frame, wake);
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
      <PlaybackSurface video={video} failed={failed} wake={wake} />
      <div className="video-preview-center">
        <VideoPlaybackStatus
          failed={failed}
          loading={loading}
          video={video}
          playback={playback}
          barToggle={barToggle}
          retry={() => {
            setAttempt((value) => value + 1);
            onRetry();
          }}
        />
      </div>
      {!failed && (
        <VideoPlaybackControls
          video={video}
          playback={playback}
          duration={duration}
          wake={wake}
          fullscreen={fullscreen}
          frame={frame}
          barToggle={barToggle}
        />
      )}
    </div>
  );
}

function VideoPlaybackStatus({
  failed,
  loading,
  video,
  playback,
  barToggle,
  retry,
}: {
  failed: boolean;
  loading: boolean;
  video: HTMLVideoElement | null;
  playback: Playback;
  barToggle: RefObject<HTMLButtonElement | null>;
  retry: () => void;
}) {
  if (failed)
    return (
      <div className="video-preview-error">
        <UiIcon icon={IconMovieOff} size="illustration" />
        <p>视频暂时无法播放</p>
        <Button size="sm" variant="ghost" className="video-preview-retry" onPress={retry}>
          重新加载
        </Button>
      </div>
    );
  if (loading)
    return (
      <span className="video-preview-loading">
        <Spinner size="md" color="current" aria-label="正在加载视频" />
      </span>
    );
  if (playback.playing || !video) return null;
  return (
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
  );
}

/** Pointer shortcut; keyboard users have the play button and the Space key. */
function PlaybackSurface({
  video,
  failed,
  wake,
}: {
  video: HTMLVideoElement | null;
  failed: boolean;
  wake: () => void;
}) {
  const press = useRef<{ id: number; x: number; y: number } | null>(null);
  return (
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
  );
}
