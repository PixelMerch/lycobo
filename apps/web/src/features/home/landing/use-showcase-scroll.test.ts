import { describe, expect, it } from "vitest";
import { showcaseStep } from "./use-showcase-scroll";

describe("showcaseStep", () => {
  it("keeps the first collection before entry and the last after exit", () => {
    expect(showcaseStep(900, 1600, 800, 2)).toBe(0);
    expect(showcaseStep(-2000, 1600, 800, 2)).toBe(1);
  });
  it("moves forward and backward without skipping the middle product", () => {
    const positions = [80, -400, -800, -400, 80];
    expect(positions.map((top) => showcaseStep(top, 2000, 800, 3))).toEqual([0, 1, 2, 1, 0]);
  });
  it("clamps short viewports and a single step", () => {
    expect(showcaseStep(-1, 400, 800, 1)).toBe(0);
    expect(showcaseStep(-1, 400, 800, 2)).toBe(1);
  });
});
