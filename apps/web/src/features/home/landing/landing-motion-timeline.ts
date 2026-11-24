import type { createLandingFeatureMotion } from "./landing-feature-motion";

/** 缓存静态布局并绘制商品画面的滚动状态，单独提供重置以支持运行时减少动态效果。 */
export function createLandingMotionTimeline(
  createFeatureMotion: typeof createLandingFeatureMotion,
) {
  const hero = document.querySelector<HTMLElement>(".lycobo-hero");
  const stage = document.querySelector<HTMLElement>(".landing-hero-stage");
  const art = document.querySelector<HTMLElement>(".landing-hero-art");
  const heading = document.querySelector<HTMLElement>(".landing-heading-row");
  const source = document.querySelector<HTMLElement>(".landing-source-proof");
  if (!hero || !stage || !art || !heading || !source) return undefined;
  const parts = { hero, stage, art, heading, source };
  const showcase = document.querySelector<HTMLElement>(".landing-work");
  const features = createFeatureMotion();
  const cases = [...document.querySelectorAll<HTMLElement>(".landing-case")].map((element) => ({
    element,
    art: element.querySelector<HTMLElement>(".landing-case-art"),
    image: element.querySelector<HTMLImageElement>(".landing-case-art > img"),
    caption: element.querySelector<HTMLElement>(".landing-case-caption"),
    top: 0,
    captionTop: 0,
  }));
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  let viewport = window.innerHeight;
  let travel = 1;
  let showcaseTop = 0;
  let showcaseHeight = 1;

  function measure() {
    viewport = window.innerHeight;
    travel = Math.max(1, parts.hero.offsetHeight - parts.stage.offsetHeight);
    const scroll = window.scrollY;
    if (showcase) {
      showcaseTop = showcase.getBoundingClientRect().top + scroll;
      showcaseHeight = Math.max(1, showcase.offsetHeight);
    }
    for (const item of cases) {
      item.top = item.element.getBoundingClientRect().top + scroll;
      if (item.caption) item.captionTop = item.caption.getBoundingClientRect().top + scroll;
    }
    features.measure(scroll, viewport);
  }

  function drawHero(scroll: number) {
    const progress = clamp(scroll / travel);
    const exit = clamp((scroll - travel) / viewport);
    const fadeDistance = viewport * 0.36;
    const blend = clamp((window.scrollY - travel + fadeDistance) / fadeDistance);
    parts.stage.style.setProperty("--landing-hero-blend", String(blend));
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
    const rise = narrow ? 44 : 88;
    const zoom = narrow ? 0.04 : 0.12;
    for (const [index, item] of cases.entries()) {
      if (!item.art || !item.image) continue;
      const offset = narrow ? 0 : (index % 2) * 64;
      const entered = clamp((scroll + viewport * 0.94 - item.top - offset) / (viewport * 0.65));
      const remaining = (1 - entered) ** 2;
      item.art.style.transform = `translate3d(0, ${remaining * rise}px, 0) scale(${1 - remaining * 0.06})`;
      item.image.style.transform = `scale(${1 + remaining * zoom})`;
      const captionProgress = clamp((scroll + viewport * 0.9 - item.captionTop) / 150);
      item.caption?.style.setProperty("--landing-caption-progress", String(captionProgress));
    }
  }

  function drawShowcase(scroll: number) {
    if (!showcase) return;
    // 仅交叉淡入两层背景色，图片、文字与背景共用当前滚动进度。
    const progress = clamp((scroll + viewport * 0.58 - showcaseTop) / showcaseHeight);
    const strength = clamp(progress / 0.2) * clamp((1 - progress) / 0.2);
    const cool = clamp((progress - 0.38) / 0.28);
    showcase.style.setProperty("--landing-showcase-warm", String(strength * (1 - cool)));
    showcase.style.setProperty("--landing-showcase-cool", String(strength * cool));
  }

  return {
    measure,
    draw(scroll: number) {
      drawHero(scroll);
      drawCases(scroll);
      drawShowcase(scroll);
      features.draw(scroll);
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
      for (const item of cases) item.caption?.style.removeProperty("--landing-caption-progress");
      stage.style.removeProperty("--landing-hero-blend");
      showcase?.style.removeProperty("--landing-showcase-warm");
      showcase?.style.removeProperty("--landing-showcase-cool");
      features.reset();
    },
  };
}
