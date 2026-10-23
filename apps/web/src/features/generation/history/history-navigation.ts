/** Shared viewport boundary for task navigation and scroll-based selection. */
export function historyContentTop() {
  const header = document.querySelector<HTMLElement>(".topbar");
  const title = document.querySelector<HTMLElement>(".workspace-tabs > .tabs__list-container");
  const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
  const titleHeight = title?.getBoundingClientRect().height ?? 0;
  const gap = title ? Number.parseFloat(getComputedStyle(title).marginBottom) || 0 : 0;
  // The title may not be stuck yet when navigating from the top of the page.
  // Use its height at the sticky header boundary, not its current page offset.
  return headerBottom + titleHeight + gap;
}

export function scrollToHistoryTask(id: string) {
  const target = document.getElementById(`job-${id}`);
  if (!target) return;
  window.scrollTo({
    top: Math.max(0, window.scrollY + target.getBoundingClientRect().top - historyContentTop()),
    behavior: "instant",
  });
}
