import { describe, expect, it } from "vitest";
import { type SilkInput, SilkMotion } from "./silk-motion";

const input = (overrides: Partial<SilkInput> = {}): SilkInput => ({
  width: 1000,
  height: 500,
  pointer: { x: 0, y: 0, inside: false },
  speed: 2.4,
  interactionStrength: 0.8,
  still: false,
  ...overrides,
});

describe("SilkMotion", () => {
  it("applies the first palette at once and eases later changes", () => {
    const motion = new SilkMotion(false);
    motion.setPalette([0.2, 0.3, 0.1], [0.6, 1, 0]);
    expect(motion.frame(input()).color).toEqual([0.2, 0.3, 0.1]);
    motion.setPalette([1, 0.7, 0.5], [1, 0.7, 0.5]);
    motion.step(1 / 60, input());
    const halfway = motion.frame(input()).color;
    expect(halfway[0]).toBeGreaterThan(0.2);
    expect(halfway[0]).toBeLessThan(1);
    for (let frame = 0; frame < 240; frame++) motion.step(1 / 60, input());
    expect(motion.frame(input()).color[0]).toBeCloseTo(1, 2);
  });

  it("ripples and surges on pulse, then lets the waves fade", () => {
    const motion = new SilkMotion(false);
    motion.setPalette([0, 0, 0], [1, 1, 1]);
    motion.pulse(0.25, 0.75);
    motion.step(1 / 60, input());
    const waves = motion.frame(input()).waves;
    expect(waves[0]).toBeCloseTo(0.25);
    expect(waves[1]).toBeCloseTo(0.75);
    expect(waves[3]).toBeGreaterThan(0);
    for (let frame = 0; frame < 300; frame++) motion.step(1 / 60, input({ speed: 0 }));
    expect(motion.frame(input()).waves[3]).toBe(0);
  });

  it("stops animating and snaps colours when the picture must stay still", () => {
    const motion = new SilkMotion(true);
    const reduced = input({ still: true });
    motion.setPalette([0, 0, 0], [1, 1, 1]);
    motion.setPalette([1, 0, 0], [0, 1, 0]);
    motion.pulse(0.5, 0.5);
    expect(motion.step(1 / 60, reduced)).toBe(false);
    const frame = motion.frame(reduced);
    expect(frame.color).toEqual([1, 0, 0]);
    expect(frame.presence).toBe(1);
    expect(frame.waves[3]).toBe(0);
  });
});
