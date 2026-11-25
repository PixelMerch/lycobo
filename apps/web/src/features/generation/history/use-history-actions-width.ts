import { useEffect, useRef } from "react";

/** 为历史卡片的顶部操作预留宽度，避免提示词正文和按钮重叠。 */
export function useHistoryActionsWidth(enabled = true) {
  const actionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!enabled) return;
    const actions = actionsRef.current;
    const article = actions?.closest<HTMLElement>(".generation-job");
    if (!actions || !article) return;
    const measure = () =>
      article.style.setProperty(
        "--history-actions-width",
        `${actions.getBoundingClientRect().width}px`,
      );
    const observer = new ResizeObserver(measure);
    observer.observe(actions);
    measure();
    return () => {
      observer.disconnect();
      article.style.removeProperty("--history-actions-width");
    };
  }, [enabled]);
  return actionsRef;
}
