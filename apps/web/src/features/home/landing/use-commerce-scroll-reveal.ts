import { useScroll, useTransform } from "motion/react";
import { type RefObject, useSyncExternalStore } from "react";

const motionPreference = "(prefers-reduced-motion: reduce)";

function subscribeMotionPreference(listener: () => void) {
  const media = window.matchMedia(motionPreference);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

const readMotionPreference = () => window.matchMedia(motionPreference).matches;

/** 让各段主画面随视口进入恢复原尺寸，减少动态效果时直接显示。 */
export function useCommerceScrollReveal(
  target: RefObject<HTMLElement | null>,
  offsetY: number,
  startScale: number,
  endOffset: "end end" | "center center" | "start center" = "end end",
) {
  const reduced = useSyncExternalStore(subscribeMotionPreference, readMotionPreference, () => true);
  const { scrollYProgress } = useScroll({ target, offset: ["start end", endOffset] });
  const opacity = useTransform(scrollYProgress, [0, 1], [0.35, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [offsetY, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [startScale, 1]);
  return reduced ? { opacity: 1, y: 0, scale: 1 } : { opacity, y, scale };
}
