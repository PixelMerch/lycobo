import { type MotionProps, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

// 全屏弹窗只在视口中心轻微缩放并淡入淡出（用户 2026-11-10 反馈原来从 0 放大太快、看着头晕）：
// 打开 400ms 减速，关闭 300ms 先慢后快；缩放幅度只有 4%。
const openTransition = { duration: 0.4, ease: [0.33, 1, 0.68, 1] } as const;
const closeTransition = { duration: 0.3, ease: [0.4, 0, 0.2, 1] } as const;
// 关闭动画没有发出完成事件时的兜底卸载时间，比关闭动画稍长。
const closeFallbackMs = 400;

/** 全屏弹窗的居中开关动画：关闭动画播完才卸载官方弹窗并恢复焦点；减少动态效果时不做动画。 */
export function useCenteredDialogMotion(onClose: () => void) {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<"open" | "closed">("open");
  const closing = useRef(false);
  const finished = useRef(false);
  const finishClose = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onClose();
  }, [onClose]);
  // 打开动画被打断时界面可能已经停在关闭的状态，Motion 不会再发完成事件；关闭中的弹窗绝不能一直挂着。
  useEffect(() => {
    if (phase !== "closed") return;
    const timer = setTimeout(finishClose, closeFallbackMs);
    return () => clearTimeout(timer);
  }, [phase, finishClose]);
  const requestClose = () => {
    if (closing.current) return;
    closing.current = true;
    if (reducedMotion) finishClose();
    else setPhase("closed");
  };
  const instant = { duration: 0 };
  const surfaceMotion: MotionProps = {
    initial: reducedMotion ? false : "closed",
    animate: phase,
    variants: {
      open: { scale: 1, opacity: 1, transition: reducedMotion ? instant : openTransition },
      closed: { scale: 0.96, opacity: 0, transition: reducedMotion ? instant : closeTransition },
    },
    onAnimationComplete: (definition) => {
      if (definition === "closed" && closing.current) finishClose();
    },
  };
  return { phase, requestClose, surfaceMotion };
}
