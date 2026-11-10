import { describe, expect, it } from "vitest";
import {
  aspectRatio,
  assetColumns,
  dayHeading,
  groupByDay,
  masonryPositions,
} from "./asset-layout";

const sized = (width: number, height: number, id = `${width}x${height}`) => ({
  id,
  width,
  height,
});

describe("asset library layout", () => {
  it("packs mixed proportions without overlaps or changing input order", () => {
    const items = [sized(1, 2, "tall"), sized(2, 1, "wide"), sized(1, 1, "square")];
    const positions = masonryPositions(items, 412, 2, 12);
    expect(positions.map((item) => item.column)).toEqual([1, 2, 2]);
    expect(positions[2]?.row).toBeGreaterThan((positions[1]?.row ?? 0) + (positions[1]?.span ?? 0));
    expect(positions[0]?.height).toBe(400);
    expect(items.map((item) => item.id)).toEqual(["tall", "wide", "square"]);
    const appended = masonryPositions([...items, sized(3, 4)], 412, 2, 12);
    expect(appended.slice(0, items.length)).toEqual(positions);
  });

  it("preserves extreme ratios and reserves a square for unknown dimensions", () => {
    expect(aspectRatio(sized(4000, 100))).toBe(40);
    expect(aspectRatio(sized(0, 0))).toBe(1);
    expect(masonryPositions([sized(10, 10)], 0, 2, 12)).toEqual([]);
    expect(masonryPositions([sized(10, 10)], 100, 0, 12)).toEqual([]);
  });

  it("groups newest-first assets by local day and names recent days", () => {
    const now = new Date(2026, 10, 3, 15, 0);
    const at = (day: number, hour: number) => new Date(2026, 10, day, hour).toISOString();
    const groups = groupByDay([
      { created_at: at(3, 14) },
      { created_at: at(3, 9) },
      { created_at: at(2, 21) },
      { created_at: at(1, 8) },
    ]);
    expect(groups.map((group) => group.items.length)).toEqual([2, 1, 1]);
    expect(dayHeading(at(3, 14), "zh-CN", now)).toEqual({ label: "今天", detail: "11月3日 周二" });
    expect(dayHeading(at(2, 21), "zh-CN", now)).toEqual({ label: "昨天", detail: "11月2日 周一" });
    expect(dayHeading(new Date(2026, 9, 31, 10).toISOString(), "zh-CN", now)).toEqual({
      label: "10月31日",
      detail: "周六",
    });
    expect(dayHeading(new Date(2025, 11, 31, 10).toISOString(), "zh-CN", now).label).toBe(
      "2025年12月31日",
    );
    expect(dayHeading(at(3, 14), "en", now)).toEqual({ label: "Today", detail: "Nov 3 Tue" });
    expect(dayHeading(new Date(2025, 11, 31, 10).toISOString(), "en", now).label).toBe(
      "Dec 31, 2025",
    );
  });

  it("fits six columns on a 1920 screen, five on 1440 and two on a phone", () => {
    expect(assetColumns(1872)).toBe(6);
    expect(assetColumns(1392)).toBe(5);
    expect(assetColumns(976)).toBe(4);
    expect(assetColumns(720)).toBe(3);
    expect(assetColumns(358)).toBe(2);
  });
});
