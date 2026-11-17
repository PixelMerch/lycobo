/** 让宽屏画框、摄影画面与参数成片跟随同一段滚动进度。 */
export function initializeLandingShowreel() {
  const section = document.querySelector<HTMLElement>("[data-landing-showreel]");
  const stage = section?.querySelector<HTMLElement>("[data-showreel-stage]");
  const media = section?.querySelector<HTMLElement>("[data-showreel-media]");
  const title = media?.querySelector("h2");
  const room = media?.querySelector<HTMLElement>("[data-showreel-room]");
  const macro = media?.querySelector<HTMLElement>("[data-showreel-macro]");
  const studio = media?.querySelector<HTMLElement>("[data-showreel-studio]");
  const light = media?.querySelector<HTMLElement>("[data-showreel-light]");
  const cards = media?.querySelector<HTMLElement>("[data-showreel-cards]");
  const cardWindow = cards?.querySelector<HTMLElement>("[data-showreel-card-window]");
  const track = cards?.querySelector<HTMLElement>("[data-showreel-track]");
  if (!section || !stage || !media || !title || !room || !macro || !studio || !light) return;
  if (!cards || !cardWindow || !track) return;

  const viewport = matchMedia(
    "(min-width: 350px) and (min-height: 620px) and (prefers-reduced-motion: no-preference)",
  );
  let travel = 0;
  let approach = 0;
  let cardTravel = 0;
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

    // 画框经过舞台上缘后继续下落，在镜头推进前归位。
    const landing = ease(progress, 0.23, 0.49);
    const forward = ease(progress, 0.35, 0.57);
    const detail = ease(progress, 0.48, 0.59);
    const reveal = ease(progress, 0.59, 0.74);
    const cardEntry = ease(progress, 0.76, 0.88);
    const cardScroll = ease(progress, 0.81, 0.99);

    media.style.transform = `translate3d(0,${-31 * (1 - landing)}svh,0) scale(${0.965 + 0.035 * landing})`;
    room.style.transform = `scale(${1.02 + forward * 0.18}) translateX(${-2.8 * forward}%)`;
    macro.style.opacity = String(detail);
    macro.style.transform = `translate3d(${3 * (1 - detail)}%,0,0) scale(${1.02 + 0.075 * detail})`;
    studio.style.clipPath = `inset(0 ${(1 - reveal) * 100}% 0 0)`;
    light.style.opacity = String(0.68 * (1 - Math.abs(reveal * 2 - 1)));
    light.style.transform = `translate3d(${(reveal - 0.5) * 108}%,0,0)`;
    title.style.opacity = String(1 - ease(progress, 0.76, 0.86));
    cards.style.transform = `translate3d(${(1 - cardEntry) * 100}%,0,0)`;
    track.style.transform = `translate3d(${-cardTravel * cardScroll}px,0,0)`;
  };

  const measure = () => {
    section.toggleAttribute("data-showreel-motion", viewport.matches);
    cardWindow.tabIndex = viewport.matches ? -1 : 0;
    if (!viewport.matches) {
      travel = 0;
      for (const element of [media, title, room, macro, studio, light, cards, track]) {
        element.removeAttribute("style");
      }
      return;
    }
    travel = Math.max(1, section.clientHeight - stage.clientHeight);
    approach = innerHeight * 0.48;
    cardTravel = Math.max(0, track.offsetWidth - cardWindow.clientWidth);
    lastProgress = Number.NaN;
    draw();
  };

  addEventListener("scroll", draw, { passive: true });
  addEventListener("resize", measure, { passive: true });
  viewport.addEventListener("change", measure);
  measure();
}
