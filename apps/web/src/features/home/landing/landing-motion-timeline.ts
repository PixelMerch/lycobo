import type { createLandingDemoMotion } from "./landing-demo-motion";
import type { createLandingFeatureMotion } from "./landing-feature-motion";

/** 缓存静态布局并绘制商品画面的滚动状态，单独提供重置以支持运行时减少动态效果。 */
export function createLandingMotionTimeline(
  createFeatureMotion: typeof createLandingFeatureMotion,
  createDemoMotion: typeof createLandingDemoMotion,
) {
  const hero = document.querySelector<HTMLElement>(".lycobo-hero");
  const stage = document.querySelector<HTMLElement>(".landing-hero-stage");
  const art = document.querySelector<HTMLElement>(".landing-hero-art");
  const heading = document.querySelector<HTMLElement>(".landing-heading-row");
  const source = document.querySelector<HTMLElement>(".landing-source-proof");
  if (!hero || !stage || !art || !heading || !source) return undefined;
  const parts = { hero, stage, art, heading, source };
  const features = createFeatureMotion();
  const demos = createDemoMotion();
  const optimizeArt = document.querySelector<HTMLElement>(
    ".landing-feature-optimize .landing-case-art",
  );
  const optimizeImage = optimizeArt?.querySelector<HTMLImageElement>("img");
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  let viewport = window.innerHeight;
  let travel = 1;
  let optimizeTop = 0;

  function measure() {
    viewport = window.innerHeight;
    travel = Math.max(1, parts.hero.offsetHeight - parts.stage.offsetHeight);
    const scroll = window.scrollY;
    const optimizeSection = optimizeArt?.closest(".landing-feature-optimize");
    if (optimizeSection) optimizeTop = optimizeSection.getBoundingClientRect().top + scroll;
    demos.measure(scroll, viewport);
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

  function drawOptimize(scroll: number) {
    if (!optimizeArt || !optimizeImage) return;
    const narrow = window.innerWidth < 768;
    const rise = narrow ? 44 : 88;
    const zoom = narrow ? 0.04 : 0.12;
    const entered = clamp((scroll + viewport * 0.94 - optimizeTop) / (viewport * 0.65));
    const remaining = (1 - entered) ** 2;
    optimizeArt.style.transform = `translate3d(0, ${remaining * rise}px, 0) scale(${1 - remaining * 0.06})`;
    optimizeImage.style.transform = `scale(${1 + remaining * zoom})`;
  }

  return {
    measure,
    draw(scroll: number) {
      drawHero(scroll);
      drawOptimize(scroll);
      demos.draw(scroll);
      features.draw(scroll);
    },
    reset() {
      for (const element of [art, heading, source, optimizeArt, optimizeImage]) {
        element?.style.removeProperty("transform");
        element?.style.removeProperty("opacity");
        element?.style.removeProperty("pointer-events");
      }
      stage.style.removeProperty("--landing-hero-blend");
      demos.reset();
      features.reset();
    },
  };
}
