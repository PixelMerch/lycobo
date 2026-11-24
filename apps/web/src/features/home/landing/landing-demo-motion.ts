/** 更新场景对比和套图预览，发生手动操作后停止推进对应演示。 */
export function createLandingDemoMotion() {
  const comparison = createComparison();
  const planner = createPlanner();

  return {
    measure(scroll: number, viewport: number) {
      comparison?.measure(scroll, viewport);
      planner?.measure(scroll);
    },
    draw(scroll: number) {
      comparison?.draw(scroll);
      planner?.draw(scroll);
    },
    reset() {
      comparison?.reset();
      planner?.reset();
    },
  };

  function createComparison() {
    const art = document.querySelector<HTMLElement>(".landing-comparison-art");
    const control = art?.querySelector<HTMLInputElement>(".landing-comparison-range");
    if (!art || !control) return undefined;

    let start = 0;
    let distance = 1;
    let lastValue = 57;
    let manual = false;

    function show(value: number) {
      if (value === lastValue) return;
      lastValue = value;
      art?.style.setProperty("--landing-comparison-cut", `${value}%`);
    }

    control.hidden = false;
    control.addEventListener("input", () => {
      manual = true;
      show(control.valueAsNumber);
    });

    return {
      measure(scroll: number, viewport: number) {
        start = art.getBoundingClientRect().top + scroll - viewport * 0.67;
        distance = Math.max(1, Math.min(art.offsetHeight, viewport) * 0.66);
      },
      draw(scroll: number) {
        if (manual || document.activeElement === control) return;
        const progress = Math.max(0, Math.min(1, (scroll - start) / distance));
        control.valueAsNumber = Math.round(76 - progress * 24);
        show(control.valueAsNumber);
      },
      reset() {
        if (manual) return;
        control.valueAsNumber = 57;
        show(57);
      },
    };
  }

  function createPlanner() {
    const panel = document.querySelector<HTMLElement>(".landing-planner");
    const track = panel?.closest<HTMLElement>(".landing-feature-track");
    if (!panel || !track) return undefined;
    const stages = [
      ...panel.querySelectorAll<HTMLInputElement>('input[name="landing-plan-phase"]'),
    ];
    let manual = false;
    let pinned = false;
    let start = 0;
    let distance = 1;

    panel.addEventListener("input", () => {
      manual = true;
    });

    return {
      measure(scroll: number) {
        const top = Number.parseFloat(getComputedStyle(panel).top);
        pinned = Number.isFinite(top);
        start = track.getBoundingClientRect().top + scroll - (top || 0);
        distance = Math.max(1, track.offsetHeight - panel.offsetHeight);
      },
      draw(scroll: number) {
        if (manual || panel.contains(document.activeElement)) return;
        const progress = pinned ? (scroll - start) / distance : 0;
        const index = Number(progress > 0.18) + Number(progress > 0.65);
        const stage = stages[index];
        if (stage && !stage.checked) stage.checked = true;
      },
      reset() {
        const first = stages[0];
        if (!manual && first) first.checked = true;
      },
    };
  }
}
