import { type MotionProps, useReducedMotion } from "motion/react";

const openTransition = { duration: 0.4, ease: [0.33, 1, 0.68, 1] } as const;

/** 共享全屏弹窗的居中入场，减少动态效果时直接显示。 */
export function useCenteredDialogEntrance(): MotionProps {
  const reducedMotion = useReducedMotion();
  return {
    initial: reducedMotion ? false : { scale: 0.96, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: reducedMotion ? { duration: 0 } : openTransition,
  };
}
