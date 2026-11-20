/** 为双行评价补齐无缝循环宽度，离屏或后台停止动画，键盘与触屏保留原生阅读。 */
export function initializeLandingReviews() {
  const section = document.querySelector<HTMLElement>(".landing-reviews");
  if (!section) return;
  const rows = [...section.querySelectorAll<HTMLElement>(".landing-review-row")];
  const staticMode = window.matchMedia("(prefers-reduced-motion: reduce), (pointer: coarse)");
  let disposed = false;

  function copy(element: Element) {
    const duplicate = element.cloneNode(true);
    if (!(duplicate instanceof HTMLElement)) return null;
    duplicate.setAttribute("data-review-copy", "");
    duplicate.setAttribute("aria-hidden", "true");
    // 卡片没有可交互后代；隐藏读屏副本，同时让循环中的每张卡片都能响应悬停高亮。
    return duplicate;
  }

  function repeatCards(group: HTMLElement, repeats: number) {
    const cards = [...group.children];
    for (let repeat = 1; repeat < repeats; repeat++) {
      for (const card of cards) {
        const duplicate = copy(card);
        if (duplicate) group.append(duplicate);
      }
    }
  }

  function prepareRow(row: HTMLElement) {
    for (const duplicate of row.querySelectorAll("[data-review-copy]")) duplicate.remove();
    row.scrollLeft = 0;
    if (staticMode.matches) return;
    const track = row.querySelector<HTMLElement>(".landing-review-track");
    const group = track?.querySelector<HTMLElement>(".landing-review-group");
    if (!track || !group) return;
    const width = group.getBoundingClientRect().width;
    if (!width) return;
    repeatCards(group, Math.ceil(row.clientWidth / width));
    const duplicate = copy(group);
    if (duplicate) track.append(duplicate);
    // 每秒移动 28px；宽屏补齐后延长周期，避免内容数量改变滚动速度。
    track.style.setProperty("--review-duration", `${group.getBoundingClientRect().width / 28}s`);
  }

  function configure() {
    if (disposed || !section) return;
    section.removeAttribute("data-reviews-ready");
    for (const row of rows) {
      prepareRow(row);
      // 只有确实可横向滚动的区域进入 Tab 顺序，方向键由浏览器原生处理。
      row.tabIndex = row.scrollWidth > row.clientWidth ? 0 : -1;
    }
    section.toggleAttribute("data-reviews-ready", !staticMode.matches);
  }

  function visibility() {
    section?.toggleAttribute("data-page-hidden", document.hidden);
  }

  const observer = new IntersectionObserver(([entry]) => {
    section.toggleAttribute("data-outside", !entry?.isIntersecting);
  });
  observer.observe(section);
  visibility();
  document.addEventListener("visibilitychange", visibility);
  staticMode.addEventListener("change", configure);
  window.addEventListener("resize", configure, { passive: true });
  void document.fonts.ready.then(configure);
  window.addEventListener(
    "pagehide",
    () => {
      disposed = true;
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      staticMode.removeEventListener("change", configure);
      window.removeEventListener("resize", configure);
    },
    { once: true },
  );
}
