import { describe, expect, it } from "vitest";
import { easedImageZoom, imageWheelFactor } from "../../components/image-zoom-motion";
import { wheelZoomTarget } from "./use-preview-zoom";

describe("shared preview wheel zoom", () => {
  it("matches reference preview sensitivity regardless of event count", () => {
    let goal = 100;
    for (let index = 0; index < 100; index += 1) goal = wheelZoomTarget(goal, -1);
    expect(goal).toBeCloseTo(110);
    expect(goal).toBeCloseTo(wheelZoomTarget(100, -100));
    expect(wheelZoomTarget(100, 0)).toBe(100);
  });
  it("shares pulse limits, pinch acceleration and zoom bounds", () => {
    expect(imageWheelFactor(-10000)).toBe(imageWheelFactor(-150));
    expect(imageWheelFactor(-150, true)).toBeCloseTo(1.1 ** 6);
    expect(wheelZoomTarget(499, -100)).toBe(500);
    expect(wheelZoomTarget(26, 100)).toBe(25);
  });
  it("eases toward the goal without overshoot and settles precisely", () => {
    expect(easedImageZoom(100, 200, 16)).toBeGreaterThan(100);
    expect(easedImageZoom(100, 200, 16)).toBeLessThan(200);
    expect(easedImageZoom(110, 100, 16)).toBeGreaterThan(100);
    expect(easedImageZoom(100.2, 100, 16)).toBe(100);
  });
});
