import { useScroll } from "motion/react";
import { useRef, useSyncExternalStore } from "react";

const storyQuery =
  "(min-width: 1100px) and (min-height: 760px) and (prefers-reduced-motion: no-preference)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(storyQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

const getSnapshot = () => window.matchMedia(storyQuery).matches;
const getServerSnapshot = () => false;

/** 桌面以原生滚动推进家纺舞台，小屏、短窗口和减少动态模式直接展示完整组图。 */
export function useTextileScroll() {
  const target = useRef<HTMLElement>(null);
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { scrollYProgress } = useScroll({
    target,
    offset: ["start 64px", "end end"],
  });
  return { target, enabled, progress: scrollYProgress };
}
