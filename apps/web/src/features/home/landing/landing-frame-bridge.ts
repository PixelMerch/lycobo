/** 隔离正文向宿主报告滚动位置、正文点按以及创作入口。 */
export function initializeLandingFrameBridge() {
  let frame = 0;

  function reportScroll() {
    frame = 0;
    parent.postMessage({ type: "lycobo:landing-scroll", scrollY: window.scrollY }, "*");
  }

  window.addEventListener(
    "scroll",
    () => {
      if (!frame) frame = requestAnimationFrame(reportScroll);
    },
    { passive: true },
  );
  document.addEventListener(
    "pointerdown",
    () => {
      parent.postMessage("lycobo:landing-pointerdown", "*");
    },
    true,
  );
  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.source !== parent) return;
    if (event.data === "lycobo:landing-scroll-request") {
      reportScroll();
      return;
    }
    const data = event.data;
    if (
      !data ||
      typeof data !== "object" ||
      !("type" in data) ||
      data.type !== "lycobo:restore-scroll"
    )
      return;
    if (!("scrollY" in data)) return;
    const { scrollY } = data;
    if (typeof scrollY !== "number" || !Number.isFinite(scrollY) || scrollY < 0) return;
    void document.fonts.ready.then(() => window.scrollTo({ top: scrollY, behavior: "instant" }));
  });
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const path = event.target.closest("a[data-landing-path]")?.getAttribute("data-landing-path");
    if (!path) return;
    event.preventDefault();
    // 宿主仅接受预先允许的站内路径。
    parent.postMessage({ type: "lycobo:navigate", path }, "*");
  });
  reportScroll();
}
