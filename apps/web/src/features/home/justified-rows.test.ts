import { describe, expect, it } from "vitest";
import { type JustifiedRow, justifyRows, targetRowHeight } from "./justified-rows";

const portrait = 4 / 5;
const square = 1;
const landscape = 4 / 3;
// 与首页灵感示例相同的 13 张比例与顺序。
const samples = [
  portrait,
  portrait,
  portrait,
  portrait,
  portrait,
  square,
  square,
  square,
  square,
  square,
  landscape,
  portrait,
  square,
];
const gap = 4;
// 手机、平板、1440 桌面与 1920 宽屏下案例墙的实际宽度。
const widths = [350, 848, 1264, 1744];

/** 一行实际占用的宽度：每张宽度（行高 × 宽高比）之和加上间距。 */
function usedWidth(row: JustifiedRow) {
  const tiles = samples.slice(row.start, row.end);
  return tiles.reduce((sum, aspect) => sum + aspect * row.height, 0) + gap * (tiles.length - 1);
}

describe("justifyRows", () => {
  it("keeps every sample exactly once and in order", () => {
    for (const width of widths) {
      const rows = justifyRows(samples, { width, gap });
      expect(rows[0]?.start).toBe(0);
      expect(rows.at(-1)?.end).toBe(samples.length);
      rows.slice(1).forEach((row, index) => {
        expect(row.start).toBe(rows[index]?.end);
      });
    }
  });

  it("fills every row edge to edge, including the last one", () => {
    for (const width of widths) {
      for (const row of justifyRows(samples, { width, gap })) {
        expect(row.filled).toBe(true);
        expect(usedWidth(row)).toBeCloseTo(width, 6);
      }
    }
  });

  it("keeps rows close to the target height on phone and desktop", () => {
    for (const width of widths) {
      const target = targetRowHeight(width);
      for (const row of justifyRows(samples, { width, gap })) {
        expect(row.height).toBeGreaterThan(target * 0.7);
        expect(row.height).toBeLessThan(target * 1.4);
      }
    }
  });

  it("caps a short row instead of stretching two images across a wide screen", () => {
    const [row] = justifyRows([portrait, landscape], { width: 1264, gap });
    expect(row?.filled).toBe(false);
    expect(row?.height).toBeCloseTo(targetRowHeight(1264) * 1.8, 6);
  });

  it("lays out nothing until the container width is known", () => {
    expect(justifyRows(samples, { width: 0, gap })).toEqual([]);
    expect(justifyRows([], { width: 1264, gap })).toEqual([]);
  });
});
