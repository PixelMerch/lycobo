/** 在隔离落地页内覆盖原生滚动条，保持 window 滚动作为现有动画的唯一进度来源。 */
export function initializeLandingScrollbar() {
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
}
