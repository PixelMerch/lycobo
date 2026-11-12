import { useEffect, useRef, useState } from "react";

/** 只播放视口中当前选中的样片，并同步暂停离开视口的轮播。 */
export function useHeroPlayback(active: number, reducedMotion: boolean) {
  const stageRef = useRef<HTMLElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const stage = stageRef.current;
    const video = stage?.querySelectorAll<HTMLVideoElement>(".vm-example video").item(active);
    if (!stage || !video || reducedMotion) {
      setPlaying(false);
      return;
    }
    let inView = false;
    function updatePlayback() {
      const visible = inView && !document.hidden;
      setPlaying(visible);
      if (visible) void video?.play().catch(() => undefined);
      else video?.pause();
    }
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? false;
      updatePlayback();
    });
    observer.observe(stage);
    document.addEventListener("visibilitychange", updatePlayback);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", updatePlayback);
      video.pause();
    };
  }, [active, reducedMotion]);

  return { stageRef, playing };
}
