/** 将工具演示的六个状态绑定到原生滚动，保留原有标签切换与媒体过渡。 */
export function initializeLandingFeatureScroll() {
  const showcase = document.querySelector<HTMLElement>("[data-oah-studio-features]");
  if (!showcase) return;
  const triggers = Array.from(
    showcase.querySelectorAll<HTMLButtonElement>("[data-oah-studio-feature-trigger]"),
  );
  if (triggers.length < 2) return;

  const track = document.createElement("div");
  track.className = "lycobo-feature-scroll-track";
  showcase.before(track);
  track.append(showcase);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let stepDistance = 1;
  let stickyTop = 0;
  let frame = 0;
  let scrollIndex = -1;

  function update() {
    frame = 0;
    const progress = (stickyTop - track.getBoundingClientRect().top) / stepDistance;
    const index = Math.max(0, Math.min(triggers.length - 1, Math.floor(progress)));
    if (index === scrollIndex) return;
    scrollIndex = index;
    // 复用参考稿的切换入口，使画面、展开说明和选中状态始终同步。
    if (triggers[index]?.getAttribute("aria-selected") !== "true") triggers[index]?.click();
  }

  function scheduleUpdate() {
    if (!frame) frame = window.requestAnimationFrame(update);
  }

  const resize = () => {
    const height = showcase.offsetHeight;
    // 固定停留位置不依赖展开文案高度，避免手机切换时跨越进度边界来回跳动。
    stickyTop = Math.min(88, Math.max(16, window.innerHeight * 0.1));
    stepDistance = Math.max(280, window.innerHeight * 0.55);
    track.style.height = `${height + stepDistance * triggers.length}px`;
    showcase.style.top = `${stickyTop}px`;
    track.classList.toggle("is-reduced-motion", reducedMotion.matches);
    scrollIndex = -1;
    scheduleUpdate();
  };

  function seek(index: number) {
    scrollIndex = index;
    const start = window.scrollY + track.getBoundingClientRect().top - stickyTop;
    window.scrollTo({ top: start + (index + 0.25) * stepDistance, behavior: "instant" });
  }

  // 手动点选或方向键仍可跳转，下一次滚动从对应段继续，不抢走键盘焦点。
  triggers.forEach((trigger, index) => {
    trigger.addEventListener("click", (event) => {
      if (!event.isTrusted) return;
      seek(index);
    });
    trigger.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      seek(triggers.findIndex((item) => item.getAttribute("aria-selected") === "true"));
    });
  });
  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", resize, { passive: true });
  reducedMotion.addEventListener("change", resize);
  new ResizeObserver(resize).observe(showcase);
  resize();
}
