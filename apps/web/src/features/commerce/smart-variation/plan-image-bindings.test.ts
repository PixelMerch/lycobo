import { describe, expect, it } from "vitest";
import { itemReferenceIndexes, mentionedImageNumbers } from "./plan-image-bindings";

const references = [{ id: "product" }, { id: "first" }, { id: "second" }];
const roles = { first: "source", second: "source" } as const;

describe("plan image bindings", () => {
  it("keeps sending every image when no image is marked as a source", () => {
    expect(itemReferenceIndexes([{ id: "a", prompt: "把参考图2翻译" }], references, {}, {})).toBe(
      undefined,
    );
  });

  it("binds each item to the shared images and the sources its prompt mentions", () => {
    const items = [
      { id: "a", prompt: "把参考图2中的文案翻译成西班牙语" },
      { id: "b", prompt: "把@图片3中的文案翻译成西班牙语" },
    ];
    expect(itemReferenceIndexes(items, references, roles, {})).toEqual({ a: [0, 1], b: [0, 2] });
  });

  it("uses a manual choice instead of the prompt mentions", () => {
    const items = [{ id: "a", prompt: "把参考图2翻译" }];
    expect(itemReferenceIndexes(items, references, roles, { a: [3] })).toEqual({ a: [0, 2] });
    expect(itemReferenceIndexes(items, references, roles, { a: [] })).toEqual({ a: [0] });
  });

  it("reads both the planner and the user mention styles", () => {
    expect([...mentionedImageNumbers("参考图2、@图片10 与参考图 3")]).toEqual([2, 10, 3]);
  });
});
