/** 隔离正文报告导航，并让顶栏与页脚共用 FAQ 定位，避免锚点离开 srcdoc。 */
export function initializeLandingFrameBridge() {
  let frame = 0;

  function reportScroll() {
    frame = 0;
    parent.postMessage({ type: "lycobo:landing-scroll", scrollY: window.scrollY }, "*");
  }

  function scrollFaq() {
    void document.fonts.ready.then(() => {
      const faq = document.querySelector<HTMLElement>("#faq");
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      faq?.querySelector<HTMLElement>("#faq-title")?.focus({ preventScroll: true });
      faq?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
    });
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
      scrollFaq();
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
    if (event.target.closest('a[data-landing-anchor="faq"]')) {
      event.preventDefault();
      scrollFaq();
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
