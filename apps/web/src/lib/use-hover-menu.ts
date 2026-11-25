import { useEffect, useRef, useState } from "react";

/**
 * 顶部栏下拉菜单的开合状态：鼠标悬停展开、移出后稍等收起，点击与键盘仍交给 HeroUI Dropdown。
 * 悬停展开时不抢占焦点，避免用户正在输入时被打断。
 */
export function useHoverMenu(closeDelay = 160) {
  const [isOpen, setOpen] = useState(false);
  const [openedByHover, setOpenedByHover] = useState(false);
  const hovering = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLElement>(null);

  function cancelClose() {
    hovering.current = true;
    window.clearTimeout(timer.current);
  }
  function openOnHover() {
    cancelClose();
    if (isOpen) return;
    setOpenedByHover(true);
    setOpen(true);
  }
  function closeSoon() {
    hovering.current = false;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), closeDelay);
  }
  function close() {
    hovering.current = false;
    window.clearTimeout(timer.current);
    setOpen(false);
  }
  function onOpenChange(next: boolean) {
    // 鼠标仍停在入口或菜单上时忽略点击触发的关闭，避免悬停展开后一点入口就收起。
    if (!next && hovering.current) return;
    if (next) setOpenedByHover(false);
    setOpen(next);
  }

  useEffect(() => () => window.clearTimeout(timer.current), []);
  // 非模态弹层不会因点按空白处关闭；触屏没有“移出”，这里补上按下外部即收起。
  useEffect(() => {
    if (!isOpen) return;
    function dismissOutside(event: PointerEvent) {
      const path = event.composedPath();
      if (popoverRef.current && path.includes(popoverRef.current)) return;
      if (triggerRef.current && path.includes(triggerRef.current)) return;
      hovering.current = false;
      setOpen(false);
    }
    document.addEventListener("pointerdown", dismissOutside, true);
    return () => document.removeEventListener("pointerdown", dismissOutside, true);
  }, [isOpen]);

  return {
    isOpen,
    openedByHover,
    triggerRef,
    popoverRef,
    openOnHover,
    closeSoon,
    cancelClose,
    close,
    onOpenChange,
  };
}
