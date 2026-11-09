import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

function readScrolled() {
  return window.scrollY > 0;
}

/** 页面是否已离开顶部：顶部栏在顶部保持透明，向下滚动后换成半透明磨砂底。 */
export function useWindowScrolled() {
  // 只在“是否离开顶部”变化时重新渲染，滚动过程中的其他位置变化不会触发更新。
  return useSyncExternalStore(subscribe, readScrolled, () => false);
}
