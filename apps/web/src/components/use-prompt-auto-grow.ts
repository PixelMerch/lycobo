import { type RefObject, useLayoutEffect } from "react";

const autoGrowMinHeight = 100;
export function useAutoGrow(ref: RefObject<HTMLElement | null>, value: string, enabled: boolean) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (!enabled) {
      element.style.removeProperty("height");
      element.style.removeProperty("overflow-y");
      return;
    }
    let width = -1;
    let bottomPadding = "";
    const fit = () => {
      // Measure out of flow: collapsing the live editor clamps its ancestor's scrollTop.
      const measure = element.cloneNode(true);
      if (!(measure instanceof HTMLElement)) return;
      measure.removeAttribute("id");
      measure.removeAttribute("name");
      measure.setAttribute("aria-hidden", "true");
      measure.inert = true;
      Object.assign(measure.style, {
        position: "absolute",
        visibility: "hidden",
        pointerEvents: "none",
        top: "0",
        left: "0",
        height: "auto",
        minHeight: "0",
        width: `${element.getBoundingClientRect().width}px`,
      });
      element.parentElement?.append(measure);
      const contentHeight = value.length ? measure.scrollHeight : autoGrowMinHeight;
      measure.remove();
      element.style.height = `${Math.max(contentHeight, autoGrowMinHeight)}px`;
      element.style.overflowY = "hidden";
    };
    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? 0;
      // Responsive toolbar spacing can change the content box without changing its width.
      const nextPadding = getComputedStyle(element).paddingBottom;
      if (Math.abs(nextWidth - width) < 1 && nextPadding === bottomPadding) return;
      width = nextWidth;
      bottomPadding = nextPadding;
      fit();
    });
    fit();
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [enabled, ref, value]);
}
