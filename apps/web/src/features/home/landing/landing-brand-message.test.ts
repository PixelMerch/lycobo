import { describe, expect, it } from "vitest";
import { readLandingBrand } from "./landing-brand-message";

const valid = {
  type: "lycobo:brand",
  x: 24,
  y: 18,
  width: 148,
  height: 44,
  progress: 0.5,
  theme: "dark",
};

describe("landing brand boundary", () => {
  it("accepts both themes and endpoint progress", () => {
    expect(readLandingBrand(valid)?.progress).toBe(0.5);
    expect(readLandingBrand({ ...valid, theme: "light", progress: 1 })?.theme).toBe("light");
    expect(readLandingBrand({ ...valid, progress: 0 })?.progress).toBe(0);
  });
  it("rejects unrelated messages, invalid numbers and unbounded canvas sizes", () => {
    for (const data of [
      null,
      {},
      { ...valid, type: "lycobo:header" },
      { ...valid, x: Infinity },
      { ...valid, y: NaN },
      { ...valid, progress: -1 },
      { ...valid, progress: 1.1 },
      { ...valid, width: 0 },
      { ...valid, width: 10000 },
      { ...valid, height: -4 },
      { ...valid, theme: "unknown" },
    ]) {
      expect(readLandingBrand(data)).toBeNull();
    }
  });
});
