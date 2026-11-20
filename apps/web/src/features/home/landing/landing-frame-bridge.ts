/** 隔离正文报告导航，并让顶栏与页脚共用 Pricing、FAQ 定位，避免锚点离开 srcdoc。 */
export function initializeLandingFrameBridge() {
  let frame = 0;

  function reportScroll() {
    frame = 0;
    parent.postMessage({ type: "lycobo:landing-scroll", scrollY: window.scrollY }, "*");
  }

  function scrollSection(section: "pricing" | "faq") {
    void document.fonts.ready.then(() => {
      const target = document.getElementById(section);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById(`${section}-title`)?.focus({ preventScroll: true });
      target?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
    });
  }

  function restoreScroll(data: unknown) {
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
    if (event.data === "lycobo:landing-faq-request") {
      scrollSection("faq");
      return;
    }
    if (event.data === "lycobo:landing-pricing-request") {
      scrollSection("pricing");
      return;
    }
    restoreScroll(event.data);
  });
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const anchor = event.target
      .closest("a[data-landing-anchor]")
      ?.getAttribute("data-landing-anchor");
    if (anchor === "faq" || anchor === "pricing") {
      event.preventDefault();
      scrollSection(anchor);
      return;
    }
    const path = event.target.closest("a[data-landing-path]")?.getAttribute("data-landing-path");
    if (!path) return;
    event.preventDefault();
    // 宿主仅接受预先允许的站内路径。
    parent.postMessage({ type: "lycobo:navigate", path }, "*");
  });
  reportScroll();
}
