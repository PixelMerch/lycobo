/** Shared wheel sensitivity and easing for reference and generated image previews. */
export function imageWheelFactor(deltaY: number, ctrlKey = false) {
  const delta = Math.max(-150, Math.min(150, deltaY)) * (ctrlKey ? 4 : 1);
  return Math.exp(-delta * (Math.log(1.1) / 100));
}

export function easedImageZoom(current: number, goal: number, elapsed: number) {
  return Math.abs(goal - current) < 0.3
    ? goal
    : current + (goal - current) * (1 - Math.exp(-Math.min(64, elapsed) / 70));
}
