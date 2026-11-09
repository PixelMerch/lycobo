import { Button, Slider, ToggleButton, Tooltip } from "@heroui/react";
import {
  IconMaximize,
  IconMinimize,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconVolume,
  IconVolumeOff,
} from "@tabler/icons-react";
import type { RefObject } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { formatVideoTime, type useVideoPlayback } from "./use-video-playback";
import { videoPlayerMessages } from "./video-player-messages";

export function togglePlayback(video: HTMLVideoElement) {
  if (video.paused || video.ended) void video.play().catch(() => undefined);
  else video.pause();
}
export function toggleFullscreen(frame: HTMLElement) {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  else void frame.requestFullscreen().catch(() => undefined);
}

type Playback = ReturnType<typeof useVideoPlayback>;

/** 视频播放控制栏：进度、播放暂停、静音与全屏。 */
export function VideoPlaybackControls({
  video,
  playback,
  duration,
  wake,
  fullscreen,
  frame,
  barToggle,
}: {
  video: HTMLVideoElement | null;
  playback: Playback;
  duration: number;
  wake: () => void;
  fullscreen: boolean;
  frame: RefObject<HTMLDivElement | null>;
  barToggle: RefObject<HTMLButtonElement | null>;
}) {
  const t = useMessages(videoPlayerMessages);
  return (
    <div className="video-preview-controls">
      <Slider
        className="video-preview-progress"
        aria-label={t.progress}
        minValue={0}
        maxValue={duration || 1}
        step={0.1}
        value={Math.min(playback.currentTime, duration || 1)}
        formatOptions={{ style: "unit", unit: "second", maximumFractionDigits: 0 }}
        isDisabled={!video || !playback.duration || !playback.seekable}
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
            aria-label={playback.playing ? t.pause : t.play}
            isDisabled={!video}
            onPress={() => video && togglePlayback(video)}
          >
            <UiIcon
              icon={playback.playing ? IconPlayerPauseFilled : IconPlayerPlayFilled}
              size="navigation"
            />
          </Button>
          <Tooltip.Content placement="top">{playback.playing ? t.pause : t.play}</Tooltip.Content>
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
            aria-label={t.mute}
            isSelected={playback.muted}
            isDisabled={!video}
            onChange={(muted) => {
              if (video) video.muted = muted;
            }}
          >
            <UiIcon icon={playback.muted ? IconVolumeOff : IconVolume} size="navigation" />
          </ToggleButton>
          <Tooltip.Content placement="top">{playback.muted ? t.unmute : t.mute}</Tooltip.Content>
        </Tooltip>
        {document.fullscreenEnabled && (
          <Tooltip delay={0}>
            <Button
              isIconOnly
              variant="ghost"
              className="video-preview-control"
              aria-label={fullscreen ? t.exitFullscreen : t.fullscreen}
              onPress={() => frame.current && toggleFullscreen(frame.current)}
            >
              <UiIcon icon={fullscreen ? IconMinimize : IconMaximize} size="navigation" />
            </Button>
            <Tooltip.Content placement="top">
              {fullscreen ? t.exitFullscreen : t.fullscreen}
            </Tooltip.Content>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
