/** 在文档右侧叠加浮动滚动条，同步页面滚动并返回卸载清理函数。 */
export function initializePageScrollbar() {
  const rail = document.createElement("div");
  const spacer = document.createElement("div");
  rail.className = "lycobo-page-scrollbar";
  rail.setAttribute("aria-hidden", "true");
  rail.tabIndex = -1;
  rail.append(spacer);
  document.body.append(rail);

  // 滚轮、键盘和触摸仍滚动页面；浮动轨道仅提供浏览器原生的拖动入口。
  function followPage() {
    if (Math.abs(rail.scrollTop - window.scrollY) > 1) rail.scrollTop = window.scrollY;
  }

  function followRail() {
    if (Math.abs(window.scrollY - rail.scrollTop) > 1) {
      window.scrollTo({ top: rail.scrollTop, behavior: "instant" });
    }
  }

  function resize() {
    const height = document.documentElement.scrollHeight;
    spacer.style.height = `${height}px`;
    rail.hidden = height <= window.innerHeight;
    followPage();
  }

  window.addEventListener("scroll", followPage, { passive: true });
  rail.addEventListener("scroll", followRail, { passive: true });
  window.addEventListener("resize", resize, { passive: true });
  const observer = new ResizeObserver(resize);
  observer.observe(document.body);
  resize();
  return () => {
    observer.disconnect();
    window.removeEventListener("scroll", followPage);
    rail.removeEventListener("scroll", followRail);
    window.removeEventListener("resize", resize);
    rail.remove();
  };
}
