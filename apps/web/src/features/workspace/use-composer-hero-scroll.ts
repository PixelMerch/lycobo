import { useLayoutEffect, useRef } from "react";

/** Sticky geometry owns collapse; scroll only fades decoration, never changes layout or scrollTop. */
export function useComposerHeroScroll(tool: string) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const hero = ref.current?.closest<HTMLElement>(".workspace-composer-hero");
    const scroller = hero?.closest(".composer-scroll");
    if (!hero || hero.dataset.tool !== tool || !(scroller instanceof HTMLElement)) return;
    const desktop = window.matchMedia("(min-width: 768px)");
    let frame = 0;
    const update = () => {
      frame = 0;
      const height = Number.parseFloat(
        getComputedStyle(hero).getPropertyValue("--composer-hero-height"),
      );
      const header =
        Number.parseFloat(getComputedStyle(hero).getPropertyValue("--header-height")) || 60;
      const offset = desktop.matches
        ? scroller.scrollTop
        : header - scroller.getBoundingClientRect().top;
      const progress = Math.max(0, Math.min(1, offset / (height - 48)));
      hero.style.setProperty("--hero-collapse", String(progress));
      hero.dataset.collapsed = String(progress >= 1);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    scroller.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(scroller);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      scroller.removeEventListener("scroll", schedule);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [tool]);
  return ref;
}
