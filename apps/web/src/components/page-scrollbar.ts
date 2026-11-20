/** 叠加浮动滚动条并同步文档或指定面板的滚动，返回卸载清理函数。 */
export function initializePageScrollbar(panel?: HTMLElement, label?: string) {
  const scroller = panel ?? document.scrollingElement ?? document.documentElement;
  const scrollEvents = panel ?? window;
  const rail = document.createElement("div");
  const spacer = document.createElement("div");
  rail.className = "lycobo-page-scrollbar";
  if (panel) rail.classList.add("lycobo-page-scrollbar--panel");
  if (label) {
    rail.setAttribute("role", "region");
    rail.setAttribute("aria-label", label);
    rail.tabIndex = 0;
  } else {
    rail.setAttribute("aria-hidden", "true");
    rail.tabIndex = -1;
  }
  rail.append(spacer);
  (panel?.parentElement ?? document.body).append(rail);

  // 滚轮、键盘和触摸仍滚动页面；浮动轨道仅提供浏览器原生的拖动入口。
  function followPage() {
    if (Math.abs(rail.scrollTop - scroller.scrollTop) > 1) rail.scrollTop = scroller.scrollTop;
  }

  function followRail() {
    if (Math.abs(scroller.scrollTop - rail.scrollTop) > 1) {
      scrollEvents.scrollTo({ top: rail.scrollTop, behavior: "instant" });
    }
  }

  function resize() {
    const height = scroller.scrollHeight;
    spacer.style.height = `${height}px`;
    rail.hidden = height <= scroller.clientHeight;
    followPage();
  }

  scrollEvents.addEventListener("scroll", followPage, { passive: true });
  rail.addEventListener("scroll", followRail, { passive: true });
  window.addEventListener("resize", resize, { passive: true });
  const observer = new ResizeObserver(resize);
  if (panel) {
    // 面板高度固定，分页追加或筛选会改变内部列表高度。
    observer.observe(panel);
    for (const content of panel.children) observer.observe(content);
  } else {
    observer.observe(document.body);
  }
  resize();
  return () => {
    observer.disconnect();
    scrollEvents.removeEventListener("scroll", followPage);
    rail.removeEventListener("scroll", followRail);
    window.removeEventListener("resize", resize);
    rail.remove();
  };
}
