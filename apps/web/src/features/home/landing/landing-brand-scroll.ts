/** 将导航文字与图形交接绑定到距顶部的距离，仅回到顶部区域时恢复文字。 */
export function initializeLandingBrandScroll() {
  const wordmarks = document.querySelectorAll<HTMLElement>(".lycobo-nav-wordmark");
  const symbols = document.querySelectorAll<HTMLElement>(".lycobo-nav-mark");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scrollDistance = 300;
  let frame = 0;
  let riveReady = false;
  const navigation = document.querySelector<HTMLElement>("[data-nav-items]");
  const slot = document.querySelector<HTMLElement>("[data-navv3-root] .lycobo-nav-lockup");

  function report(progress: number) {
    if (!slot) return;
    const rect = slot.getBoundingClientRect();
    parent.postMessage(
      {
        type: "lycobo:brand",
        x: rect.x,
        y: rect.y,
        width: window.innerWidth < 768 ? 116 : 148,
        height: rect.height,
        progress,
        theme:
          document.documentElement.getAttribute("data-oah-theme") === "light" ? "light" : "dark",
      },
      "*",
    );
  }

  function render() {
    frame = 0;
    // 正文区域保持图形，只有顶部过渡区随滚动位置交接文字。
    const progress = Math.max(0, Math.min(1, window.scrollY / scrollDistance));
    if (slot) {
      slot.style.opacity = riveReady && !reducedMotion.matches ? "0" : "1";
      // 使用贴合字标的固定占位，滚动只改变图形，菜单始终保持原位。
      slot.style.width = "112px";
    }
    if (navigation) navigation.style.marginLeft = "0px";
    report(progress);
    renderFallback(progress);
  }

  function renderFallback(progress: number) {
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
  window.addEventListener("resize", scheduleRender, { passive: true });
  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.source !== parent || !event.data || typeof event.data !== "object") return;
    if (!("type" in event.data)) return;
    if (event.data.type === "lycobo:brand-request") scheduleRender();
    if (event.data.type !== "lycobo:brand-ready" || !("ready" in event.data)) return;
    if (typeof event.data.ready !== "boolean" || riveReady === event.data.ready) return;
    riveReady = event.data.ready;
    scheduleRender();
  });
  new MutationObserver(scheduleRender).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-oah-theme"],
  });
  if (slot) new ResizeObserver(scheduleRender).observe(slot);
  reducedMotion.addEventListener("change", scheduleRender);
  render();
}
