import { imageGenerationInputSchema, textileViews } from "@lycoboai/contracts";
import { describe, expect, it } from "vitest";
import { normalizeTextileGeneration, textileItemInput } from "./textile-generation";

const reference = crypto.randomUUID();
const input = () =>
  imageGenerationInputSchema.parse({
    model: "gpt-image-2",
    prompt: "client",
    count: 10,
    referenceAssetIds: [reference],
    textileSet: { version: 1, views: textileViews.map((view) => view.id) },
  });
describe("textile angle generation", () => {
  it("makes one distinct server-owned camera prompt per stable item position", () => {
    const normalized = normalizeTextileGeneration(input());
    const items = textileViews.map((view, index) => {
      const item = textileItemInput(normalized, index);
      expect(item.prompt).toContain(view.name);
      expect(item.prompt).toContain("第一张参考图");
      expect(item.prompt).toContain("不做拼图");
      expect(item.count).toBe(1);
      expect(item.referenceAssetIds).toEqual([reference]);
      expect(item.model).toBe("gpt-image-2.5");
      return item.prompt;
    });
    expect(new Set(items).size).toBe(10);
    expect(() => textileItemInput(normalized, 10)).toThrow("TEXTILE_VIEW_POSITION_INVALID");
    expect(normalizeTextileGeneration(normalized)).toEqual(normalized);
  });
  it("rejects duplicate, unknown, missing or count-mismatched textile views", () => {
    const original = input();
    for (const value of [
      { ...original, count: 9 },
      { ...original, referenceAssetIds: [] },
      { ...original, textileSet: { version: 1, views: ["front", "front"] }, count: 2 },
      { ...original, textileSet: { version: 1, views: ["unknown"] }, count: 1 },
      { ...original, textileSet: { version: 2, views: ["front"] }, count: 1 },
      { ...original, textileSet: undefined },
    ])
      expect(imageGenerationInputSchema.safeParse(value).success).toBe(false);
    const generic = imageGenerationInputSchema.parse({
      model: "gpt-image-2",
      prompt: "legacy",
      count: 4,
    });
    expect(generic).not.toHaveProperty("textileSet");
    expect(normalizeTextileGeneration(generic)).toBe(generic);
    expect(textileItemInput(generic, 0)).toBe(generic);
  });
});
