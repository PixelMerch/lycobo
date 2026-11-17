/** 让首屏的七张照片随滚动逐步归位，展开完整的套图。 */
export function initializeLandingHeroScroll() {
  const hero = document.querySelector<HTMLElement>("[data-landing-hero]");
  const stage = hero?.querySelector<HTMLElement>(".lycobo-hero-stage");
  if (!hero || !stage) return;

  const pairs = [...hero.querySelectorAll<HTMLElement>("[data-hero-photo]")].flatMap((start) => {
    const name = start.dataset.heroPhoto;
    const end = hero.querySelector<HTMLElement>(`[data-hero-slot="${name}"]`);
    const visual = start.querySelector<HTMLElement>(".lycobo-hero-visual");
    if (!end || !visual) return [];
    return [
      {
        start,
        end,
        visual,
        revealedOnScroll: start.hasAttribute("data-hero-reveal"),
        from: new DOMRect(),
        to: new DOMRect(),
      },
    ];
  });

  const showreel = hero.nextElementSibling;
  const viewport = matchMedia(
    "(min-width: 960px) and (min-height: 660px), (min-width: 350px) and (max-width: 959px) and (min-height: 700px)",
  );
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0;
  let drawnProgress = -1;
  let travel = 1;

  function ease(progress: number, start: number, end: number) {
    const t = Math.max(0, Math.min(1, (progress - start) / (end - start)));
    return t * t * (3 - 2 * t);
  }

  const render = () => {
    frame = 0;
    const progress = Math.max(0, Math.min(1, -hero.getBoundingClientRect().top / travel));
    if (progress === drawnProgress) return;
    drawnProgress = progress;
    const breathing = 1 - ease(progress, 0.02, 0.29);
    stage.style.setProperty("--hero-breath-strength", String(breathing));
    stage.toggleAttribute("data-breath-settled", breathing === 0);
    stage.style.setProperty("--hero-opening-opacity", String(1 - ease(progress, 0.03, 0.3)));
    stage.style.setProperty("--hero-gallery-opacity", String(ease(progress, 0.24, 0.8)));
    stage.style.setProperty("--hero-results-opacity", String(ease(progress, 0.67, 0.94)));

    for (const [index, { start, from, to, visual, revealedOnScroll }] of pairs.entries()) {
      const offset = index * 0.028;
      const t = ease(progress, 0.08 + offset, 0.8 + offset);
      const reveal = ease(progress, 0.32 + offset, 0.63 + offset);
      if (revealedOnScroll) start.style.setProperty("--hero-reveal-opacity", String(reveal));
      const x = (to.left - from.left) * t;
      const y = (to.top - from.top) * t;
      // 只改变独立画框的裁切尺寸，图片继续按原比例填充。
      visual.style.width = `${from.width + (to.width - from.width) * t}px`;
      visual.style.height = `${from.height + (to.height - from.height) * t}px`;
      visual.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
  };

  const schedule = () => {
    if (hero.hasAttribute("data-motion") && !frame) frame = requestAnimationFrame(render);
  };

  const measure = () => {
    if (!hero.hasAttribute("data-motion")) return;
    const span = showreel?.hasAttribute("data-showreel-motion")
      ? showreel.getBoundingClientRect().top - hero.getBoundingClientRect().top
      : hero.clientHeight - stage.clientHeight;
    travel = Math.max(1, span * 0.82);
    drawnProgress = -1;
    for (const pair of pairs) {
      pair.from = pair.start.getBoundingClientRect();
      pair.to = pair.end.getBoundingClientRect();
    }
    schedule();
  };

  const configure = () => {
    const enabled = viewport.matches && !reducedMotion.matches && pairs.length === 7;
    hero.toggleAttribute("data-motion", enabled);
    if (enabled) {
      measure();
      return;
    }
    cancelAnimationFrame(frame);
    frame = 0;
    stage.style.removeProperty("--hero-breath-strength");
    stage.removeAttribute("data-breath-settled");
    for (const { start, visual, end } of pairs) {
      start.style.removeProperty("--hero-reveal-opacity");
      visual.removeAttribute("style");
      if (!end.firstChild) end.append(visual.cloneNode(true));
    }
  };

  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", measure, { passive: true });
  viewport.addEventListener("change", configure);
  reducedMotion.addEventListener("change", configure);
  const observer = new ResizeObserver(measure);
  observer.observe(stage);
  observer.observe(hero);
  new IntersectionObserver(([entry]) => {
    stage.toggleAttribute("data-breath-offscreen", !entry?.isIntersecting);
  }).observe(stage);
  configure();
}
