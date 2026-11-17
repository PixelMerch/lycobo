/** 让首屏的七张照片随滚动逐一落到套图中的对应画框。 */
export function initializeLandingHeroScroll() {
  const hero = document.querySelector<HTMLElement>("[data-landing-hero]");
  const stage = hero?.querySelector<HTMLElement>(".lycobo-hero-stage");
  if (!hero || !stage) return;

  const pairs = [...hero.querySelectorAll<HTMLElement>("[data-hero-photo]")].flatMap((start) => {
    const name = start.dataset.heroPhoto;
    const end = hero.querySelector<HTMLElement>(`[data-hero-slot="${name}"]`);
    const visual = start.querySelector<HTMLElement>(".lycobo-hero-visual");
    const image = visual?.querySelector("img");
    if (!end || !visual || !image) return [];
    return [
      {
        start,
        end,
        visual,
        image,
        main: name === "studio",
        from: new DOMRect(),
        to: new DOMRect(),
      },
    ];
  });

  const viewport = matchMedia(
    "(min-width: 960px) and (min-height: 660px), (min-width: 350px) and (max-width: 959px) and (min-height: 720px)",
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
    const defocus = 1 - ease(progress, 0.04, 0.82);
    stage.style.setProperty("--hero-breath-strength", String(breathing));
    stage.toggleAttribute("data-breath-settled", breathing === 0);
    stage.style.setProperty("--hero-defocus", String(defocus));
    stage.toggleAttribute("data-hero-focused", defocus === 0);
    stage.style.setProperty("--hero-copy-opacity", String(1 - ease(progress, 0.04, 0.25)));
    stage.style.setProperty("--hero-results-opacity", String(ease(progress, 0.61, 0.99)));

    for (const [index, { from, to, visual, main }] of pairs.entries()) {
      const offset = main ? 0 : index * 0.015;
      const t = ease(progress, 0.12 + offset, 0.89 + offset);
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
    travel = Math.max(1, (hero.clientHeight - stage.clientHeight) * 0.82);
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
    stage.style.removeProperty("--hero-defocus");
    stage.removeAttribute("data-hero-focused");
    for (const { visual, end, image } of pairs) {
      visual.removeAttribute("style");
      if (!end.firstChild) end.append(image.cloneNode());
    }
  };

  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", measure, { passive: true });
  viewport.addEventListener("change", configure);
  reducedMotion.addEventListener("change", configure);
  new ResizeObserver(measure).observe(stage);
  new IntersectionObserver(([entry]) => {
    stage.toggleAttribute("data-breath-offscreen", !entry?.isIntersecting);
  }).observe(stage);
  configure();
}
