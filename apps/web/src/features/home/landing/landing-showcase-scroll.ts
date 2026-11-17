/** 用同一段滚动进度编排画框落位、原图显影与环境色切换。 */
export function initializeLandingShowcaseScroll() {
  const section = document.querySelector<HTMLElement>("[data-landing-showreel]");
  const stage = section?.querySelector<HTMLElement>(".lycobo-showreel-stage");
  const entrance = section?.querySelector<HTMLElement>("[data-showreel-entrance]");
  const reel = section?.querySelector<HTMLElement>("[data-showreel-reel]");
  const gallery = Array.from(
    section?.previousElementSibling?.querySelectorAll<HTMLElement>(
      ".lycobo-hero-photos, .lycobo-hero-results-content",
    ) ?? [],
  );
  const lights = Array.from(section?.querySelectorAll<HTMLElement>("[data-showreel-light]") ?? []);
  const results = Array.from(
    section?.querySelectorAll<HTMLElement>("[data-showreel-result]") ?? [],
  );
  if (!section || !stage || !entrance || !reel) return;
  if (results.length < 2 || results.length !== lights.length) return;

  const motion = window.matchMedia(
    "(prefers-reduced-motion: no-preference) and (min-height: 540px)",
  );
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const ease = (value: number, start: number, end: number) => {
    const t = clamp((value - start) / (end - start));
    return t * t * (3 - 2 * t);
  };
  let frame = 0;
  let lastProgress = -1;
  let lastHandoff = -1;
  let start = 0;
  let distance = 1;
  let drop = 0;

  const renderHandoff = (progress: number) => {
    const handoff = Math.min(progress, 0.24);
    if (handoff === lastHandoff) return;
    lastHandoff = handoff;
    // 两区短暂重叠，上方仍随页面退场，下方的整张画框从上方落位。
    const cover = ease(handoff, 0.008, 0.155);
    const galleryFocus = ease(handoff, 0, 0.165);
    const landing = ease(handoff, 0.025, 0.165);
    const bounce = ease(handoff, 0.165, 0.202);
    const settle = ease(handoff, 0.202, 0.24);
    const vertical = -drop * (1 - landing) + 16 * landing - 22 * bounce + 6 * settle;
    const focus = ease(handoff, 0.015, 0.165);
    stage.style.setProperty("--showreel-cover", String(cover));
    for (const content of gallery) {
      content.style.filter = galleryFocus === 0 ? "" : `blur(${galleryFocus * 11}px)`;
    }
    entrance.style.transform = `translate3d(0, ${vertical}px, 0)`;
    entrance.style.opacity = String(ease(handoff, 0.045, 0.145));
    entrance.style.filter = focus === 1 ? "" : `blur(${(1 - focus) * 7}px)`;
  };

  const renderScene = (progress: number) => {
    const scene = clamp((progress - 0.24) / 0.76) * results.length;
    const index = Math.min(results.length - 1, Math.floor(scene));
    const slide = index + (index < results.length - 1 ? ease(scene - index, 0.72, 1) : 0);
    const exit = 1 - ease(progress, 0.91, 1);
    reel.style.transform = `translate3d(calc(${-slide * 100}% - ${slide} * var(--showreel-gap)), 0, 0)`;

    results.forEach((result, resultIndex) => {
      // 同款原图保持原位，效果图的裁切边从左向右推进；两层照片不会半透明重叠。
      const reveal = ease(scene - resultIndex, 0.1, 0.53);
      result.style.clipPath = `inset(0 ${(1 - reveal) * 100}% 0 0)`;
      const light = lights[resultIndex];
      if (light)
        light.style.opacity = String(clamp(1 - Math.abs(slide - resultIndex)) * reveal * exit);
    });
  };

  const update = () => {
    frame = 0;
    if (!motion.matches) return;
    const progress = clamp((start - section.getBoundingClientRect().top) / distance);
    if (progress === lastProgress) return;
    lastProgress = progress;

    renderHandoff(progress);
    renderScene(progress);
  };

  function scheduleUpdate() {
    if (!frame && motion.matches) frame = window.requestAnimationFrame(update);
  }

  const measure = () => {
    section.toggleAttribute("data-showreel-motion", motion.matches);
    lastProgress = -1;
    lastHandoff = -1;
    if (!motion.matches) {
      stage.style.removeProperty("--showreel-cover");
      for (const content of gallery) content.style.removeProperty("filter");
      entrance.removeAttribute("style");
      reel.style.removeProperty("transform");
      for (const result of results) result.style.removeProperty("clip-path");
      return;
    }
    const padding = getComputedStyle(section);
    const paddingTop = Number.parseFloat(padding.paddingTop);
    const paddingBottom = Number.parseFloat(padding.paddingBottom);
    start = Number.parseFloat(getComputedStyle(stage).top) - paddingTop;
    distance = Math.max(1, section.clientHeight - stage.offsetHeight - paddingTop - paddingBottom);
    drop = Math.min(310, stage.offsetHeight * 0.46);
    scheduleUpdate();
  };

  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", measure, { passive: true });
  motion.addEventListener("change", measure);
  new ResizeObserver(measure).observe(stage);
  measure();
}
