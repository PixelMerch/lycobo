/** 启用绒毯展示区的原图和成图对比滑块。 */
export function initializeLandingShowcase() {
  const comparison = document.querySelector<HTMLElement>("[data-showreel-comparison]");
  const slider = comparison?.querySelector<HTMLInputElement>("[data-showreel-range]");
  if (!comparison || !slider) return;

  slider.hidden = false;
  slider.addEventListener("input", () => {
    const value = slider.valueAsNumber;
    comparison.style.setProperty("--comparison-progress", String(value / 100));
    comparison.toggleAttribute("data-showreel-source-hidden", value === 0);
    comparison.toggleAttribute("data-showreel-results-hidden", value === 100);
  });
}
