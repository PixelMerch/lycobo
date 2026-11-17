/** 将导航字标的淡出和图形旋转绑定到滚动方向与距离，反向滚动立即恢复。 */
export function initializeLandingBrandScroll() {
  const wordmarks = document.querySelectorAll<HTMLElement>(".lycobo-nav-wordmark");
  const symbols = document.querySelectorAll<HTMLElement>(".lycobo-nav-mark");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scrollDistance = 300;
  let previousScroll = Math.max(0, window.scrollY);
  let progress = Math.min(1, previousScroll / scrollDistance);
  let frame = 0;

  function render() {
    frame = 0;
    const currentScroll = Math.max(0, window.scrollY);
    // 累计相邻滚动距离；到达端点后丢弃多余距离，让任意位置的回滚立即生效。
    progress = Math.max(
      0,
      Math.min(1, progress + (currentScroll - previousScroll) / scrollDistance),
    );
    previousScroll = currentScroll;
    for (const wordmark of wordmarks) {
      wordmark.style.opacity = String(1 - progress);
      wordmark.style.transform = reducedMotion.matches ? "none" : `translateX(${-8 * progress}px)`;
    }
    for (const symbol of symbols) {
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
