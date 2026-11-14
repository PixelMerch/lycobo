import { describe, expect, it } from "vitest";
import { scrollChapterIndex } from "./use-scroll-chapter";

describe("scrollChapterIndex", () => {
  it("uses the same chapter boundaries when scrolling forward, backward or jumping", () => {
    const thresholds = [0.26, 0.5, 0.74];
    expect(
      [0, 0.26, 0.5, 0.74, 1, 0.5, 0.259, 0].map((value) => scrollChapterIndex(value, thresholds)),
    ).toEqual([0, 1, 2, 3, 3, 2, 0, 0]);
  });
  it("keeps overscroll at the first or last chapter", () => {
    expect(scrollChapterIndex(-0.1, [0.36, 0.68])).toBe(0);
    expect(scrollChapterIndex(1.1, [0.36, 0.68])).toBe(2);
  });
});
