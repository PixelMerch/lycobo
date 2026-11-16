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

/** 滚动跨越章节阈值时切换展示，手动选择保留到下一个阈值，不拦截页面滚动。 */
export function useShowcaseScroll(count: number, scrollMedia?: string) {
  const section = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const progress = useMotionValue(0);
  const manuallySelected = useRef(false);

  useEffect(() => {
    const element = section.current;
    if (!element) return;
    const media = scrollMedia ? window.matchMedia(scrollMedia) : undefined;
    let frame = 0;
    let last: number | null = -1;
    const syncMedia = () => {
      if (media?.matches !== false || last === null) return;
      last = null;
      manuallySelected.current = false;
      progress.set(1);
      setActive(count - 1);
    };
    syncMedia();
    let visible = false;
    const update = () => {
      frame = 0;
      if (!visible || document.hidden || media?.matches === false) return;
      const rect = element.getBoundingClientRect();
      const position = showcaseProgress(rect.top, rect.height, window.innerHeight);
      const next = stepAt(position, count);
      if (next !== last) {
        last = next;
        manuallySelected.current = false;
        setActive(next);
      }
      if (!manuallySelected.current) progress.set(position);
    };
    const schedule = () => {
      if (!frame && visible) frame = requestAnimationFrame(update);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      schedule();
    });
    observer.observe(element);
    media?.addEventListener("change", syncMedia);
    media?.addEventListener("change", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("visibilitychange", schedule);
    return () => {
      observer.disconnect();
      media?.removeEventListener("change", syncMedia);
      media?.removeEventListener("change", schedule);
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [count, progress, scrollMedia]);

  const select = (step: number) => {
    manuallySelected.current = true;
    progress.set((step + 0.5) / count);
    setActive(step);
  };

  return { section, active, progress, select };
}
