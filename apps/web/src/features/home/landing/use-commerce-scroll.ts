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

/** 管理商品对比的原生滚动进度与静态回退条件。 */
export function useCommerceScroll() {
  const target = useRef<HTMLElement>(null);
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { scrollYProgress } = useScroll({
    target,
    offset: ["start 64px", "end end"],
  });
  return { target, enabled, progress: scrollYProgress };
}
