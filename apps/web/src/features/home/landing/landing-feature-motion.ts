/** 同步绘制家纺分步说明与三联画，兼顾短视口的自然滚动。 */
export function createLandingFeatureMotion() {
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const features = [
    ...document.querySelectorAll<HTMLElement>(".landing-feature-textile .landing-feature-track"),
  ].flatMap((track) => {
    const panel = track.querySelector<HTMLElement>(".landing-feature-inner");
    const art = track.querySelector<HTMLElement>(".landing-feature-art");
    if (!panel || !art) return [];
    const steps = [...track.querySelectorAll<HTMLElement>(".landing-feature-steps li")].map(
      (element) => ({ element, top: 0 }),
    );
    return [
      {
        track,
        panel,
        art,
        steps,
        start: 0,
        end: 0,
        artTop: 0,
        artHeight: 1,
        distance: 1,
        pinned: false,
        lastScroll: Number.NaN,
      },
    ];
  });
  let viewport = 0;
  const artProperties = [
    "--landing-feature-second",
    "--landing-feature-third",
    "--landing-feature-crop",
    "--landing-feature-wash",
  ];

  function drawSteps(feature: (typeof features)[number], position: number, progress: number) {
    // 宽屏的取景和文案共用进度；手机在每条说明靠近视口时淡入。
    const { steps, pinned, start } = feature;
    for (const [index, { element, top }] of steps.entries()) {
      const stepStart = index === 0 ? -0.4 : index * 0.34 - 0.18;
      const reveal = pinned
        ? (progress - stepStart) / 0.22
        : (position + viewport * 0.92 - start - top) / 85;
      element.style.setProperty("--landing-feature-step", String(clamp(reveal)));
    }
  }

  return {
    measure(scroll: number, height: number) {
      viewport = height;
      for (const feature of features) {
        const { track, panel, art, steps } = feature;
        const top = track.getBoundingClientRect().top + scroll;
        const stickyTop = Number.parseFloat(getComputedStyle(panel).top);
        feature.pinned = Number.isFinite(stickyTop);
        feature.start = top - (stickyTop || 0);
        feature.end = top + track.offsetHeight;
        feature.distance = Math.max(1, track.offsetHeight - panel.offsetHeight);
        feature.artTop = art.getBoundingClientRect().top + scroll;
        feature.artHeight = art.offsetHeight;
        feature.lastScroll = Number.NaN;
        for (const step of steps) step.top = step.element.offsetTop;
      }
    },
    draw(scroll: number) {
      for (const feature of features) {
        const { track, start, end, distance, pinned, artTop, artHeight } = feature;
        const position = Math.max(start - viewport, Math.min(scroll, end));
        if (position === feature.lastScroll) continue;
        feature.lastScroll = position;
        const progress = (position - start) / distance;
        const artProgress = pinned
          ? progress
          : (position + viewport * 0.92 - artTop) / Math.max(1, artHeight * 0.82);
        const second = clamp((artProgress - 0.16) / 0.22);
        const third = clamp((artProgress - 0.5) / 0.22);
        track.style.setProperty("--landing-feature-second", String(second));
        track.style.setProperty("--landing-feature-third", String(third));
        track.style.setProperty("--landing-feature-crop", String(1 - second * 0.82 - third * 0.18));
        track.style.setProperty("--landing-feature-wash", String(0.24 + third * 0.38));

        drawSteps(feature, position, progress);
      }
    },
    reset() {
      for (const { track, steps } of features) {
        for (const property of artProperties) track.style.removeProperty(property);
        for (const { element } of steps) element.style.removeProperty("--landing-feature-step");
      }
    },
  };
}
