import { useEffect, useRef } from "react";
import { useOutletContext } from "react-router";
import type { StudioShellContext } from "../../app/studio-shell";

/** Change the header surface only when the home intro leaves its lower edge. */
export function useHomeHeaderSurface() {
  const intro = useRef<HTMLElement>(null);
  const { setHomeHeaderOpaque } = useOutletContext<StudioShellContext>();
  useEffect(() => {
    const element = intro.current;
    if (!element) return;
    const headerHeight = 60;
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
