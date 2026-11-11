/** 历史上方的吸顶条：桌面是“生成记录”标题行，窄屏标题行隐藏，改用横排工具坞。 */
function historyToolbar() {
  for (const selector of [".workspace-history-heading", ".workspace-tool-dock"]) {
    const element = document.querySelector<HTMLElement>(selector);
    if (element && element.getClientRects().length > 0) return element;
  }
  return null;
}

/** 任务内容可见区的上边界：点缩略图定位和滚动选中当前任务共用这条线。 */
export function historyContentTop() {
  const header = document.querySelector<HTMLElement>(".topbar");
  const toolbar = historyToolbar();
  const toolbarHeight = toolbar?.getBoundingClientRect().height ?? 0;
  const title = document.querySelector<HTMLElement>(".workspace-tabs > .tabs__list-container");
  const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
  const titleHeight = title?.getBoundingClientRect().height ?? 0;
  const gap = title ? Number.parseFloat(getComputedStyle(title).marginBottom) || 0 : 0;
  // 从页面顶部开始定位时吸顶条可能还没贴住，按它吸顶后的位置计算，不用当前在页面里的位置。
  const toolbarTop = toolbar ? Number.parseFloat(getComputedStyle(toolbar).top) || 0 : 0;
  return (
    Math.max(headerBottom, toolbarTop) + toolbarHeight + (toolbar ? 12 : 0) + titleHeight + gap
  );
}

/**
 * Shows where a new task appears: the history back at its top and the thumbnail index at its
 * first entry. On narrow screens the history is a hidden panel, so the form keeps its place.
 */
export function revealNewestHistory() {
  document.querySelector(".history-rail-list")?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  if (document.querySelector(".results-panel")?.getClientRects().length)
    window.scrollTo({ top: 0, behavior: "instant" });
}

export function scrollToHistoryTask(id: string) {
  const target = document.getElementById(`job-${id}`);
  if (!target) return;
  window.scrollTo({
    top: Math.max(0, window.scrollY + target.getBoundingClientRect().top - historyContentTop()),
    behavior: "instant",
  });
}
