import { useLayoutEffect, useRef } from "react";

/** 测量公共页脚高度，让超出一屏的页脚也能从顶部完整阅读。 */
export function useLandingFooterReveal() {
  const footerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const footer = footerRef.current;
    if (!footer || typeof ResizeObserver === "undefined") return;

    const measure = () => {
      footer.style.setProperty("--lp-footer-height", `${footer.offsetHeight}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(footer);

    return () => observer.disconnect();
  }, []);

  return footerRef;
}
