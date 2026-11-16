import { useEffect, useRef, useState } from "react";

/** 将章节在视口内的滚动距离映射为有边界的展示步骤。 */
export function showcaseStep(top: number, height: number, viewport: number, count: number) {
  const distance = Math.max(1, height - viewport + 80);
  const progress = Math.max(0, Math.min(1, (80 - top) / distance));
  return Math.min(count - 1, Math.floor(progress * count));
}

/** 滚动跨越章节阈值时切换展示，手动选择保留到下一个阈值，不拦截页面滚动。 */
export function useShowcaseScroll(count: number) {
  const section = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const element = section.current;
    if (!element) return;
    let frame = 0;
    let last = -1;
    let visible = false;
    const update = () => {
      frame = 0;
      if (!visible || document.hidden) return;
      const rect = element.getBoundingClientRect();
      const next = showcaseStep(rect.top, rect.height, window.innerHeight, count);
      if (next !== last) {
        last = next;
        setActive(next);
      }
    };
    const schedule = () => {
      if (!frame && visible) frame = requestAnimationFrame(update);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      schedule();
    });
    observer.observe(element);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("visibilitychange", schedule);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [count]);
  return { section, active, select: setActive };
}
