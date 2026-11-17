/** 将导航文字与图形交接绑定到距顶部的距离，仅回到顶部区域时恢复文字。 */
export function initializeLandingBrandScroll() {
  const wordmarks = document.querySelectorAll<HTMLElement>(".lycobo-nav-wordmark");
  const symbols = document.querySelectorAll<HTMLElement>(".lycobo-nav-mark");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scrollDistance = 300;
  let frame = 0;

  function render() {
    frame = 0;
    // 正文区域保持图形，只有顶部过渡区随滚动位置交接文字。
    const progress = Math.max(0, Math.min(1, window.scrollY / scrollDistance));
    for (const wordmark of wordmarks) {
      wordmark.style.opacity = String(Math.max(0, 1 - progress / 0.65));
      wordmark.style.transform = reducedMotion.matches
        ? "translateX(-23%)"
        : `translateX(calc(-23% - ${8 * progress}px))`;
    }
    for (const symbol of symbols) {
      symbol.style.opacity = String(Math.max(0, (progress - 0.35) / 0.65));
      symbol.style.transform = reducedMotion.matches ? "none" : `rotate(${-45 * progress}deg)`;
    }
  }

  function scheduleRender() {
    if (!frame) frame = window.requestAnimationFrame(render);
  }

  window.addEventListener("scroll", scheduleRender, { passive: true });
  reducedMotion.addEventListener("change", scheduleRender);
  render();
}
