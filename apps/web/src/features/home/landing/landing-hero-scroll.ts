/** 将样张退场、棚拍放大和浅色套图交接绑定到原生滚动进度。 */
export function initializeLandingHeroScroll() {
  const hero = document.querySelector<HTMLElement>("[data-landing-hero]");
  const stage = hero?.querySelector<HTMLElement>(".lycobo-hero-stage");
  const start = hero?.querySelector<HTMLElement>("[data-hero-studio-start]");
  const end = hero?.querySelector<HTMLElement>("[data-hero-studio-end]");
  if (!hero || !stage || !start || !end) return;

  const root = document.documentElement;
  const viewport = window.matchMedia(
    "(min-width: 768px) and (min-height: 660px), (min-width: 360px) and (max-width: 767px) and (min-height: 710px)",
  );
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0;
  let geometry = { x: 0, y: 0, scale: 1, travel: 1, drift: 0 };

  function ease(progress: number, from: number, to: number) {
    const value = Math.max(0, Math.min(1, (progress - from) / (to - from)));
    return value * value * (3 - 2 * value);
  }

  const render = () => {
    frame = 0;
    const bounds = hero.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, -bounds.top / geometry.travel));
    const studio = ease(progress, 0.07, 0.95);
    const drift = ease(progress, 0.03, 0.76) * geometry.drift;
    const panel = ease(progress, 0.23, 0.86);

    hero.style.setProperty("--hero-studio-x", `${geometry.x * studio}px`);
    hero.style.setProperty("--hero-studio-y", `${geometry.y * studio}px`);
    hero.style.setProperty("--hero-studio-scale", String(1 + (geometry.scale - 1) * studio));
    hero.style.setProperty("--hero-drift-left", `${-drift}px`);
    hero.style.setProperty("--hero-drift-right", `${drift}px`);
    hero.style.setProperty("--hero-copy-opacity", String(1 - ease(progress, 0.03, 0.27)));
    hero.style.setProperty("--hero-tile-opacity", String(1 - ease(progress, 0.23, 0.73)));
    hero.style.setProperty("--hero-panel-scale", String(1 - panel));
    hero.style.setProperty("--hero-panel-opacity", String(1 - ease(progress, 0.46, 0.86)));
    hero.style.setProperty("--hero-result-opacity", String(ease(progress, 0.64, 0.99)));
    root.toggleAttribute("data-lycobo-hero-light", bounds.bottom > 80 && panel > 0.68);
  };

  const schedule = () => {
    if (hero.hasAttribute("data-motion") && !frame) frame = window.requestAnimationFrame(render);
  };

  const measure = () => {
    if (!hero.hasAttribute("data-motion")) return;
    const first = start.getBoundingClientRect();
    const last = end.getBoundingClientRect();
    if (!first.width || !last.width) return;
    geometry = {
      x: last.left - first.left,
      y: last.top - first.top,
      scale: last.width / first.width,
      // 预留末段，让白底套图停留片刻后随正文自然离场。
      travel: (hero.clientHeight - stage.clientHeight) * 0.82,
      drift: stage.clientWidth * 0.23,
    };
    schedule();
  };

  const configure = () => {
    const enabled = viewport.matches && !reducedMotion.matches;
    hero.toggleAttribute("data-motion", enabled);
    if (enabled) {
      measure();
      return;
    }
    window.cancelAnimationFrame(frame);
    frame = 0;
    root.removeAttribute("data-lycobo-hero-light");
  };

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", measure, { passive: true });
  viewport.addEventListener("change", configure);
  reducedMotion.addEventListener("change", configure);
  const observeLayout = new ResizeObserver(measure);
  observeLayout.observe(start);
  observeLayout.observe(end);
  configure();
}
