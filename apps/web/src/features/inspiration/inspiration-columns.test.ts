import { describe, expect, it } from "vitest";
import { distributeColumns } from "./inspiration-columns";

const shapes = [
  "portrait",
  "square",
  "landscape",
  "portrait",
  "square",
  "landscape",
  "portrait",
] as const;
const items = shapes.map((shape, index) => ({ id: `item-${index}`, shape }));

describe("inspiration masonry", () => {
  it("keeps every card once and in reading order inside each column", () => {
    const columns = distributeColumns(items, 3);
    const placed = columns.flatMap((column) => column.items.map((item) => item.id));
    expect(placed.sort()).toEqual(items.map((item) => item.id).sort());
    for (const column of columns) {
      const order = column.items.map((item) => items.indexOf(item));
      expect(order).toEqual([...order].sort((left, right) => left - right));
    }
  });

  it("does not move earlier cards when more cards are appended", () => {
    const before = distributeColumns(items.slice(0, 4), 3);
    const after = distributeColumns(items, 3);
    before.forEach((column, index) => {
      expect(after[index]?.items.slice(0, column.items.length)).toEqual(column.items);
    });
  });

  it("puts the next card in the shortest column", () => {
    const [first, second] = distributeColumns(
      [
        { id: "tall", shape: "portrait" },
        { id: "wide", shape: "landscape" },
        { id: "next", shape: "square" },
      ],
      2,
    );
    expect(first?.items.map((item) => item.id)).toEqual(["tall"]);
    expect(second?.items.map((item) => item.id)).toEqual(["wide", "next"]);
  });
});
