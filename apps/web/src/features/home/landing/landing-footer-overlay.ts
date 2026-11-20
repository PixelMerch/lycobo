/** 测量 FAQ 的真实高度以启用原生停驻，让整块页脚覆盖 FAQ，并保证被覆盖的键盘焦点可读。 */
export function initializeLandingFooterOverlay() {
  const stage = document.querySelector<HTMLElement>(".landing-faq-stage");
  const faq = document.querySelector<HTMLElement>(".landing-faq");
  const footer = document.querySelector<HTMLElement>(".landing-footer");
  if (!stage || !faq || !footer || typeof ResizeObserver === "undefined") return;
  const elements = { stage, faq, footer };

  function measure() {
    // 展开答案、字体和屏宽变化时更新；长 FAQ 先滚到末尾，再固定到视口底部。
    elements.faq.style.setProperty("--landing-faq-height", `${elements.faq.offsetHeight}px`);
  }

  function revealFocus(event: FocusEvent) {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.id === "faq-title") return;
    if (elements.footer.getBoundingClientRect().top >= target.getBoundingClientRect().bottom)
      return;
    // Shift+Tab 回到后层问答时，通过未停驻的容器还原阅读位置，避免焦点被前层遮住。
    elements.stage.scrollIntoView({ block: "start", behavior: "instant" });
    target.scrollIntoView({ block: "nearest", behavior: "instant" });
  }

  document.body.setAttribute("data-footer-overlay", "");
  measure();
  const observer = new ResizeObserver(measure);
  observer.observe(faq);
  faq.addEventListener("focusin", revealFocus);
  window.addEventListener(
    "pagehide",
    () => {
      observer.disconnect();
      faq.removeEventListener("focusin", revealFocus);
      faq.style.removeProperty("--landing-faq-height");
      document.body.removeAttribute("data-footer-overlay");
    },
    { once: true },
  );
}
