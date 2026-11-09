import { type RefObject, useLayoutEffect } from "react";

const autoGrowMinHeight = 100;
/** 按实际内容伸展输入区，达到样式上限后保留内部滚动。 */
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
      // 用脱离文档流的副本测量，避免收缩真实输入区导致页面滚动跳动。
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
        maxHeight: "none",
        width: `${element.getBoundingClientRect().width}px`,
      });
      element.parentElement?.append(measure);
      const contentHeight = value.length ? measure.scrollHeight : autoGrowMinHeight;
      measure.remove();
      element.style.height = `${Math.max(contentHeight, autoGrowMinHeight)}px`;
      const capped = getComputedStyle(element).maxHeight !== "none";
      element.style.overflowY =
        capped && element.scrollHeight > element.clientHeight + 1 ? "auto" : "hidden";
    };
    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? 0;
      // 工具条留白可能单独变化，不能只按宽度判断是否需要重测。
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
