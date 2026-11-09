import { useEffect, useRef } from "react";
import { useOutletContext } from "react-router";
import type { StudioShellContext } from "../../app/studio-shell";

/** 首屏滚出 Header 下沿时才切换 Header 底色，回到顶部恢复透明。 */
export function useHomeHeaderSurface() {
  const intro = useRef<HTMLElement>(null);
  const { setHomeHeaderOpaque } = useOutletContext<StudioShellContext>();
  useEffect(() => {
    const element = intro.current;
    if (!element) return;
    // Header 高度来自全站变量：桌面 64px、手机 60px。
    const headerHeight =
      Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--header-height"),
      ) || 64;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setHomeHeaderOpaque(entry.boundingClientRect.bottom <= headerHeight);
      },
      { rootMargin: `-${headerHeight}px 0px 0px 0px`, threshold: 0 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      setHomeHeaderOpaque(false);
    };
  }, [setHomeHeaderOpaque]);
  return intro;
}
