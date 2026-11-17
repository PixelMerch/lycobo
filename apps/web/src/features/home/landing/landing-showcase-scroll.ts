/** 编排套图区到黑底图片对比的滚动交接。 */
export function initializeLandingShowcaseScroll() {
  const section = document.querySelector<HTMLElement>("[data-landing-showreel]");
  const stage = section?.querySelector<HTMLElement>(".lycobo-showreel-stage");
  const entrance = section?.querySelector<HTMLElement>("[data-showreel-entrance]");
  const gallery = Array.from(
    section?.previousElementSibling?.querySelectorAll<HTMLElement>(
      ".lycobo-hero-photos, .lycobo-hero-results-content",
    ) ?? [],
  );
  if (!section || !stage || !entrance) return;

  const comparison = section.querySelector<HTMLElement>("[data-showreel-comparison]");
  const slider = comparison?.querySelector<HTMLInputElement>("[data-showreel-range]");
  if (comparison && slider) {
    slider.hidden = false;
    slider.addEventListener("input", () => {
      comparison.style.setProperty("--comparison-progress", String(slider.valueAsNumber / 100));
      comparison.toggleAttribute("data-showreel-source-hidden", slider.valueAsNumber === 0);
      comparison.toggleAttribute("data-showreel-results-hidden", slider.valueAsNumber === 100);
    });
  }

  const motion = window.matchMedia(
    "(prefers-reduced-motion: no-preference) and (min-height: 540px) and (min-width: 621px)",
  );
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const ease = (value: number, start: number, end: number) => {
    const t = clamp((value - start) / (end - start));
    return t * t * (3 - 2 * t);
  };
  let frame = 0;
  let lastHandoff = -1;
  let start = 0;
  let distance = 1;
  let drop = 0;

  const renderHandoff = (progress: number) => {
    const handoff = Math.min(progress, 0.68);
    if (handoff === lastHandoff) return;
    lastHandoff = handoff;
    // 两区短暂重叠，上方仍随页面退场，下方的整张画框从上方落位。
    const cover = ease(handoff, 0.02, 0.44);
    const galleryFocus = ease(handoff, 0, 0.46);
    const landing = ease(handoff, 0.07, 0.46);
    const bounce = ease(handoff, 0.46, 0.57);
    const settle = ease(handoff, 0.57, 0.68);
    const vertical = -drop * (1 - landing) + 16 * landing - 22 * bounce + 6 * settle;
    const focus = ease(handoff, 0.04, 0.46);
    stage.style.setProperty("--showreel-cover", String(cover));
    for (const content of gallery) {
      content.style.filter = galleryFocus === 0 ? "" : `blur(${galleryFocus * 11}px)`;
    }
    entrance.style.transform = `translate3d(0, ${vertical}px, 0)`;
    entrance.style.opacity = String(ease(handoff, 0.13, 0.41));
    entrance.style.filter = focus === 1 ? "" : `blur(${(1 - focus) * 7}px)`;
  };

  const update = () => {
    frame = 0;
    if (!motion.matches) return;
    const progress = clamp((start - section.getBoundingClientRect().top) / distance);
    renderHandoff(progress);
  };

  function scheduleUpdate() {
    if (!frame && motion.matches) frame = window.requestAnimationFrame(update);
  }

  const measure = () => {
    section.toggleAttribute("data-showreel-motion", motion.matches);
    lastHandoff = -1;
    if (!motion.matches) {
      stage.style.removeProperty("--showreel-cover");
      for (const content of gallery) content.style.removeProperty("filter");
      entrance.removeAttribute("style");
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
