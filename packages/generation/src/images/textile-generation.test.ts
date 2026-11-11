import { imageGenerationInputSchema, imageProviderModel, textileViews } from "@lycoboai/contracts";
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
      { ...original, textileSet: { version: 6, views: ["front"] }, count: 1 },
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

it("accepts five detail references in v2 while preserving v1 reference rules", () => {
  const refs = Array.from({ length: 6 }, () => crypto.randomUUID());
  const value = {
    model: "gpt-image-2.5",
    prompt: "textile",
    count: 1,
    referenceAssetIds: refs,
    textileSet: { version: 2, views: ["front"] },
  };
  const parsed = imageGenerationInputSchema.parse(value);
  expect(textileItemInput(parsed, 0).referenceAssetIds).toEqual(refs);
  expect(textileItemInput(parsed, 0).prompt).toContain("第二至第六张参考图");
  expect(
    imageGenerationInputSchema.safeParse({
      ...value,
      referenceAssetIds: [...refs, crypto.randomUUID()],
    }).success,
  ).toBe(false);
  expect(
    imageGenerationInputSchema.safeParse({ ...value, textileSet: { version: 1, views: ["front"] } })
      .success,
  ).toBe(false);
});

it("uses the selected v3 resolution while keeping stored v1/v2 tasks at 1K", () => {
  const base = {
    model: "gpt-image-2.5",
    prompt: "textile",
    referenceAssetIds: [crypto.randomUUID()],
    count: 1,
  };
  for (const resolution of ["1K", "2K", "4K"]) {
    const current = normalizeTextileGeneration(
      imageGenerationInputSchema.parse({
        ...base,
        resolution,
        textileSet: { version: 3, views: ["front"] },
      }),
    );
    expect(current.resolution).toBe(resolution);
    for (const version of [1, 2])
      expect(
        normalizeTextileGeneration(
          imageGenerationInputSchema.parse({
            ...base,
            resolution,
            textileSet: { version, views: ["front"] },
          }),
        ).resolution,
      ).toBe("1K");
  }
});

it("routes every new textile resolution to the requested 4K channel and preserves old presets", () => {
  for (const resolution of ["1K", "2K", "4K"]) {
    for (const version of [1, 2, 3, 4]) {
      const normalized = normalizeTextileGeneration(
        imageGenerationInputSchema.parse({
          ...input(),
          count: 1,
          resolution,
          textileSet: { version, views: ["front"] },
        }),
      );
      expect(imageProviderModel(normalized)).toBe(
        version === 4 ? "gpt-image-2-4K" : "gpt-image-2.5-sunburst",
      );
      expect(normalized.resolution).toBe(version >= 3 ? resolution : "1K");
    }
  }
});
it("preserves legacy textile inputs and accepts the public 2.6 model for new v5 jobs", () => {
  const original = imageGenerationInputSchema.parse({
    ...input(),
    resolution: "1K",
    textileSet: { version: 5, views: textileViews.map((v) => v.id) },
  });
  const current = normalizeTextileGeneration(original);
  expect(current.model).toBe("gpt-image-2.5");
  expect(current.count).toBe(10);
  expect(textileItemInput(current, 0)).toMatchObject({ model: "gpt-image-2.5", count: 1 });
  const newJob = normalizeTextileGeneration({ ...original, model: "gpt-image-2.6" });
  expect(textileItemInput(newJob, 0)).toMatchObject({ model: "gpt-image-2.6", count: 1 });
  expect(
    normalizeTextileGeneration({
      ...original,
      textileSet: { views: original.textileSet?.views ?? [], version: 4 },
    }).model,
  ).toBe("gpt-image-2-4K");
});
