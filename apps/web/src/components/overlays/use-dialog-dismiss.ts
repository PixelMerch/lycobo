import { useReducedMotion } from "motion/react";
import { type AnimationEvent, useEffect, useRef, useState } from "react";

/** 让由外层按需挂载的 Modal 播完关闭动画，再通知外层卸载和恢复焦点。 */
export function useDialogDismiss(onClose: () => void) {
  const reducedMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(true);
  const close = useRef<(() => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function finish() {
    clearTimeout(timer.current);
    const callback = close.current;
    close.current = null;
    callback?.();
  }

  function requestClose() {
    if (close.current) return;
    if (reducedMotion) {
      onClose();
      return;
    }
    close.current = onClose;
    setIsOpen(false);
    // 动画取消或没有派发结束事件时，仍要释放弹窗。
    timer.current = setTimeout(finish, 560);
  }

  function onAnimationEnd(event: AnimationEvent<HTMLElement>) {
    if (event.target === event.currentTarget && event.animationName === "heroui-overlay-fade-out")
      finish();
  }

  return { isOpen, requestClose, onAnimationEnd };
}
