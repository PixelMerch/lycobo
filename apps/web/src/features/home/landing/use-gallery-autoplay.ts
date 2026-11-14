import { useInView } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

function subscribeReducedMotion(notify: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}

const readReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 原生横向图带低速往返移动，离屏、后台、交互和减少动态效果时停止。 */
export function useGalleryAutoplay() {
  const rail = useRef<HTMLElement>(null);
  const visible = useInView(rail);
  const reduced = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => true);
  const [paused, setPaused] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const direction = useRef(1);
  useEffect(() => {
    const element = rail.current;
    if (!element || !visible || reduced || paused || engaged) return;
    let frame = 0;
    let lastTime = 0;
    let position = element.scrollLeft;
    const tick = (time: number) => {
      if (document.hidden) return;
      const elapsed = lastTime ? Math.min(time - lastTime, 64) : 0;
      lastTime = time;
      const maximum = element.scrollWidth - element.clientWidth;
      position += direction.current * elapsed * 0.028;
      if (position >= maximum) {
        position = maximum;
        direction.current = -1;
      }
      if (position <= 0) {
        position = 0;
        direction.current = 1;
      }
      element.scrollLeft = position;
      frame = requestAnimationFrame(tick);
    };
    const onVisibility = () => {
      cancelAnimationFrame(frame);
      lastTime = 0;
      if (!document.hidden) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [visible, reduced, paused, engaged]);
  const move = (amount: number) => {
    setPaused(true);
    rail.current?.scrollBy({
      left: amount * rail.current.clientWidth * 0.7,
      behavior: reduced ? "instant" : "smooth",
    });
  };
  return { rail, reduced, paused, setPaused, setEngaged, move };
}
