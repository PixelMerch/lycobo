import { useMotionValue } from "motion/react";
import { useEffect, useRef, useState } from "react";

function showcaseProgress(top: number, height: number, viewport: number) {
  const distance = Math.max(1, height - viewport + 80);
  return Math.max(0, Math.min(1, (80 - top) / distance));
}

function stepAt(progress: number, count: number) {
  return Math.min(count - 1, Math.floor(progress * count));
}

/** 将章节在视口内的滚动距离映射为有边界的展示步骤。 */
export function showcaseStep(top: number, height: number, viewport: number, count: number) {
  return stepAt(showcaseProgress(top, height, viewport), count);
}

/** 同步原生滚动进度，只在跨越章节阈值时更新当前步骤。 */
export function useShowcaseScroll(count: number, scrollMedia?: string) {
  const section = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const progress = useMotionValue(0);

  useEffect(() => {
    const element = section.current;
    if (!element) return;
    const media = scrollMedia ? window.matchMedia(scrollMedia) : undefined;
    let frame = 0;
    let last = -1;
    let visible = false;
    const update = () => {
      frame = 0;
      if (!visible || document.hidden || media?.matches === false) return;
      const rect = element.getBoundingClientRect();
      const position = showcaseProgress(rect.top, rect.height, window.innerHeight);
      const next = stepAt(position, count);
      if (next !== last) {
        last = next;
        setActive(next);
      }
      progress.set(position);
    };
    const schedule = () => {
      if (!frame && visible) frame = requestAnimationFrame(update);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      schedule();
    });
    observer.observe(element);
    media?.addEventListener("change", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("visibilitychange", schedule);
    return () => {
      observer.disconnect();
      media?.removeEventListener("change", schedule);
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [count, progress, scrollMedia]);

  return { section, active, progress };
}
