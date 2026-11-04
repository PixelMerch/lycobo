import { useEffect, useState } from "react";

export type VideoPlayback = {
  playing: boolean;
  ended: boolean;
  /** Loading the first frame, or stalled while playback was requested. */
  waiting: boolean;
  /** The current frame is decoded, so the poster may give way to the video. */
  ready: boolean;
  failed: boolean;
  /** Without range support a browser can only restart, so scrubbing must stay off. */
  seekable: boolean;
  muted: boolean;
  currentTime: number;
  duration: number;
  width: number;
  height: number;
};

const initial: VideoPlayback = {
  playing: false,
  ended: false,
  waiting: true,
  ready: false,
  failed: false,
  seekable: false,
  muted: false,
  currentTime: 0,
  duration: 0,
  width: 0,
  height: 0,
};
const startsWaiting = ["loadstart", "waiting"];
const stopsWaiting = ["playing", "canplay", "loadeddata", "pause", "suspend", "error", "ended"];
const changes = [
  "play",
  "durationchange",
  "loadedmetadata",
  "timeupdate",
  "seeked",
  "volumechange",
  "emptied",
];

export const canSeek = (video: HTMLVideoElement) =>
  video.seekable.length > 0 && video.seekable.end(video.seekable.length - 1) > 0;

/** Mirrors a media element into React; the element stays the playback source of truth. */
export function useVideoPlayback(video: HTMLVideoElement | null) {
  const [state, setState] = useState(initial);
  useEffect(() => {
    if (!video) return;
    let waiting = true;
    // Seeking briefly drops readyState; once a frame was shown the poster must not flash back.
    let shown = false;
    let frame: number | null = null;
    const read = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) shown = true;
      setState({
        playing: !video.paused && !video.ended,
        ended: video.ended,
        waiting: waiting && video.error === null,
        ready: shown,
        failed: video.error !== null,
        seekable: canSeek(video),
        muted: video.muted,
        currentTime: video.currentTime,
        duration: Number.isFinite(video.duration) ? video.duration : 0,
        width: video.videoWidth,
        height: video.videoHeight,
      });
    };
    // timeupdate fires a few times a second; follow the frame clock while playing.
    const tick = () => {
      read();
      frame = video.paused || video.ended ? null : requestAnimationFrame(tick);
    };
    const follow = () => {
      if (frame === null) frame = requestAnimationFrame(tick);
    };
    const start = () => {
      waiting = true;
      read();
    };
    const stop = () => {
      waiting = false;
      read();
    };
    for (const name of startsWaiting) video.addEventListener(name, start);
    for (const name of stopsWaiting) video.addEventListener(name, stop);
    for (const name of changes) video.addEventListener(name, read);
    video.addEventListener("playing", follow);
    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) waiting = false;
    read();
    if (!video.paused) follow();
    return () => {
      for (const name of startsWaiting) video.removeEventListener(name, start);
      for (const name of stopsWaiting) video.removeEventListener(name, stop);
      for (const name of changes) video.removeEventListener(name, read);
      video.removeEventListener("playing", follow);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [video]);
  return state;
}

/** Media clock for player chrome: 0:03, 1:05. */
export function formatVideoTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
