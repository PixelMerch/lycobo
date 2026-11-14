import { describe, expect, it } from "vitest";
import { wrapGalleryPosition } from "./gallery-loop";

describe("wrapGalleryPosition", () => {
  it("keeps the same fractional image position across either seam", () => {
    const width = 4271.953125;
    expect(wrapGalleryPosition(width * 2 + 0.5, width)).toBeCloseTo(width + 0.5);
    expect(wrapGalleryPosition(width - 0.5, width)).toBeCloseTo(width * 2 - 0.5);
  });
  it("preserves forward motion after wrapping, including large jumps", () => {
    expect(wrapGalleryPosition(2002, 1000)).toBe(1002);
    expect(wrapGalleryPosition(2004, 1000)).toBe(1004);
    expect(wrapGalleryPosition(7004, 1000)).toBe(1004);
    expect(wrapGalleryPosition(-996, 1000)).toBe(1004);
  });
  it("does not relocate an unmeasured rail", () => {
    expect(wrapGalleryPosition(8, 0)).toBe(8);
  });
});
