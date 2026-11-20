/** 缓存静态布局并绘制商品画面的滚动状态，单独提供重置以支持运行时减少动态效果。 */
export function createLandingMotionTimeline() {
  const hero = document.querySelector<HTMLElement>(".lycobo-hero");
  const stage = document.querySelector<HTMLElement>(".landing-hero-stage");
  const art = document.querySelector<HTMLElement>(".landing-hero-art");
  const heading = document.querySelector<HTMLElement>(".landing-heading-row");
  const source = document.querySelector<HTMLElement>(".landing-source-proof");
  if (!hero || !stage || !art || !heading || !source) return undefined;
  const parts = { hero, stage, art, heading, source };
  const cases = [...document.querySelectorAll<HTMLElement>(".landing-case")].map((element) => ({
    element,
    art: element.querySelector<HTMLElement>(".landing-case-art"),
    image: element.querySelector<HTMLImageElement>(".landing-case-art > img"),
    top: 0,
  }));
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  let viewport = window.innerHeight;
  let travel = 1;

  function measure() {
    viewport = window.innerHeight;
    travel = Math.max(1, parts.hero.offsetHeight - parts.stage.offsetHeight);
    for (const item of cases) item.top = item.element.getBoundingClientRect().top + window.scrollY;
  }

  function drawHero(scroll: number) {
    const progress = clamp(scroll / travel);
    const exit = clamp((scroll - travel) / viewport);
    parts.art.style.transform = `translate3d(0, ${exit * 80}px, 0) scale(${1.02 + progress * 0.14})`;
    // Tab 回到首屏操作时恢复文案，避免焦点落在随滚动淡出的按钮上。
    const fade = parts.hero.contains(document.activeElement) ? 0 : clamp((progress - 0.3) / 0.7);
    parts.heading.style.transform = `translate3d(0, ${-progress * 64}px, 0)`;
    parts.source.style.transform = `translate3d(0, ${-progress * 24}px, 0) scale(${1 - progress * 0.08})`;
    for (const element of [parts.heading, parts.source]) {
      element.style.opacity = String(1 - fade);
      element.style.pointerEvents = fade > 0.98 ? "none" : "";
    }
  }

  function drawCases(scroll: number) {
    const narrow = window.innerWidth < 768;
    for (const [index, item] of cases.entries()) {
      if (!item.art || !item.image) continue;
      const offset = narrow ? 0 : (index % 2) * 64;
      const entered = clamp((scroll + viewport * 0.94 - item.top - offset) / (viewport * 0.65));
      const remaining = (1 - entered) ** 2;
      item.art.style.transform = `translate3d(0, ${remaining * (narrow ? 44 : 88)}px, 0) scale(${1 - remaining * 0.06})`;
      item.image.style.transform = `scale(${1 + remaining * (narrow ? 0.04 : 0.12)})`;
    }
  }

  return {
    measure,
    draw(scroll: number) {
      drawHero(scroll);
      drawCases(scroll);
    },
    reset() {
      for (const element of [
        art,
        heading,
        source,
        ...cases.flatMap((item) => [item.art, item.image]),
      ]) {
        element?.style.removeProperty("transform");
        element?.style.removeProperty("opacity");
        element?.style.removeProperty("pointer-events");
      }
    },
  };
}
