/** 让宽屏画框、摄影画面与参数成片跟随同一段滚动进度。 */
export function initializeLandingShowreel() {
  const section = document.querySelector<HTMLElement>("[data-landing-showreel]");
  const stage = section?.querySelector<HTMLElement>("[data-showreel-stage]");
  const media = section?.querySelector<HTMLElement>("[data-showreel-media]");
  const title = media?.querySelector("h2");
  const room = media?.querySelector<HTMLElement>("[data-showreel-room]");
  const specs = media?.querySelector<HTMLElement>("[data-showreel-specs]");
  if (!section || !stage || !media || !title || !room || !specs) {
    return;
  }

  const viewport = matchMedia(
    "(min-width: 350px) and (min-height: 620px) and (prefers-reduced-motion: no-preference)",
  );
  let travel = 0;
  let approach = 0;
  let dropDistance = 0;
  let lastProgress = Number.NaN;

  function ease(progress: number, start: number, end: number) {
    const t = Math.max(0, Math.min(1, (progress - start) / (end - start)));
    return t * t * (3 - 2 * t);
  }

  const draw = () => {
    if (travel === 0) return;
    const progress = Math.max(
      0,
      Math.min(1, (approach - section.getBoundingClientRect().top) / (travel + approach)),
    );
    if (progress === lastProgress) return;
    lastProgress = progress;

    // 画框从舞台上缘落下时，露在画框外的套图继续变暗。
    const landing = ease(progress, 0.08, 0.31);
    const rebound = ease(progress, 0.31, 0.36);
    const settle = ease(progress, 0.36, 0.4);
    const verticalOffset = -dropDistance * (1 - landing) + 15 * landing - 21 * rebound + 6 * settle;
    const forward = ease(progress, 0.4, 0.66);
    const specsEntry = ease(progress, 0.66, 0.83);

    const cover = 0.76 * ease(progress, 0, 0.12) + 0.24 * ease(progress, 0.12, 0.31);
    stage.style.setProperty("--showreel-cover", String(cover));
    media.style.transform = `translate3d(0,${verticalOffset}px,0)`;
    room.style.transform = `scale(${1.02 + forward * 0.18}) translateX(${-2.8 * forward}%)`;
    title.style.opacity = String(1 - ease(progress, 0.66, 0.77));
    specs.style.transform = `translate3d(${(1 - specsEntry) * 100}%,0,0)`;
  };

  const measure = () => {
    const linked = section.previousElementSibling?.hasAttribute("data-motion");
    section.toggleAttribute("data-showreel-motion", viewport.matches);
    if (!viewport.matches) {
      travel = 0;
      for (const element of [stage, media, title, room, specs]) {
        element.removeAttribute("style");
      }
      return;
    }
    travel = Math.max(1, section.clientHeight - stage.clientHeight);
    approach = linked ? 0 : innerHeight * 0.48;
    dropDistance = media.offsetTop + media.offsetHeight;
    lastProgress = Number.NaN;
    draw();
  };

  addEventListener("scroll", draw, { passive: true });
  addEventListener("resize", measure, { passive: true });
  viewport.addEventListener("change", measure);
  measure();
}
