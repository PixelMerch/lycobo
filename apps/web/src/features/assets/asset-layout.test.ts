import { describe, expect, it } from "vitest";
import { dayHeading, groupByDay, justifyRows, masonryColumns } from "./asset-layout";

const sized = (width: number, height: number, id = `${width}x${height}`) => ({
  id,
  width,
  height,
});

describe("asset library layout", () => {
  it("fills every full row exactly and keeps the last row at the target height", () => {
    const items = [
      sized(1000, 1000),
      sized(750, 1000),
      sized(2000, 1000),
      sized(1000, 1000),
      sized(1333, 1000),
      sized(800, 1000),
      sized(750, 1000),
    ];
    const rows = justifyRows(items, 1278, 220, 12);
    for (const row of rows.slice(0, -1)) {
      const used = row.items.reduce((sum, entry) => sum + entry.width, 0);
      expect(used + 12 * (row.items.length - 1)).toBeCloseTo(1278, 6);
    }
    expect(rows.at(-1)?.height).toBe(220);
    // Order never changes, so the newest picture stays first.
    expect(rows.flatMap((row) => row.items.map((entry) => entry.item))).toEqual(items);
  });

  it("keeps each picture's own ratio and clamps extreme strips", () => {
    const [row] = justifyRows([sized(4000, 1000), sized(1000, 1000)], 900, 200, 10);
    const [strip, square] = row?.items ?? [];
    expect(strip && square && strip.width / square.width).toBeCloseTo(3, 6);
    expect(justifyRows([sized(10, 10)], 0, 200, 10)).toEqual([]);
  });

  it("sends each phone picture to the shorter of two columns", () => {
    const columns = masonryColumns(
      [sized(1, 2, "tall"), sized(1, 1, "a"), sized(1, 1, "b"), sized(1, 1, "c")],
      2,
    );
    expect(columns.map((column) => column.map((item) => item.id))).toEqual([
      ["tall", "c"],
      ["a", "b"],
    ]);
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
    expect(dayHeading(at(3, 14), now)).toEqual({ label: "今天", detail: "11月3日 周二" });
    expect(dayHeading(at(2, 21), now)).toEqual({ label: "昨天", detail: "11月2日 周一" });
    expect(dayHeading(new Date(2026, 9, 31, 10).toISOString(), now)).toEqual({
      label: "10月31日",
      detail: "周六",
    });
    expect(dayHeading(new Date(2025, 11, 31, 10).toISOString(), now).label).toBe("2025年12月31日");
  });
});
