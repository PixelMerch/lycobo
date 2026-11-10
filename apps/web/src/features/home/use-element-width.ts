import { useLayoutEffect, useState } from "react";

/**
 * 读取元素的内容宽度，尺寸变化时更新。挂载时在绘制前先同步量一次，
 * 依赖宽度排版的内容不会先空一帧再出现。返回值第一项交给元素的 ref。
 */
export function useElementWidth<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!element) return;
    setWidth(Math.floor(element.clientWidth));
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.floor(entry?.contentRect.width ?? 0)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [setElement, width] as const;
}
