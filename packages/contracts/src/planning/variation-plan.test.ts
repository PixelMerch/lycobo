import { expect, it } from "vitest";
import { imageGenerationInputSchema } from "../images/image-generation";
import { variationPlanInputSchema } from "./variation-plan";

it("requires meaningful requirements and at most five distinct references", () => {
  expect(
    variationPlanInputSchema.safeParse({ description: "@图片1 @", referenceAssetIds: [] }).success,
  ).toBe(false);
  expect(
    variationPlanInputSchema.safeParse({ description: "自然光商品摄影", referenceAssetIds: [] })
      .success,
  ).toBe(true);
  const id = crypto.randomUUID();
  expect(
    variationPlanInputSchema.safeParse({
      description: "自然光商品摄影",
      referenceAssetIds: [id, id],
    }).success,
  ).toBe(false);
  expect(
    variationPlanInputSchema.safeParse({
      description: "自然光商品摄影",
      referenceAssetIds: Array.from({ length: 6 }, () => crypto.randomUUID()),
    }).success,
  ).toBe(false);
});
it("allows twenty confirmed plans but forbids count mismatch and mixed tools", () => {
  const items = Array.from({ length: 20 }, (_, i) => ({
    id: crypto.randomUUID(),
    title: `商品${i}`,
    prompt: `独立商品摄影方案${i}`,
  }));
  const input = {
    model: "gpt-image-2.5",
    prompt: "智能裂变",
    count: 20,
    variation: { version: 1, planId: crypto.randomUUID(), items },
  };
  expect(imageGenerationInputSchema.safeParse(input).success).toBe(true);
  expect(imageGenerationInputSchema.safeParse({ ...input, count: 2 }).success).toBe(false);
  expect(imageGenerationInputSchema.safeParse({ ...input, variation: undefined }).success).toBe(
    false,
  );
  expect(
    imageGenerationInputSchema.safeParse({ ...input, textileSet: { version: 5, views: ["front"] } })
      .success,
  ).toBe(false);
});

it("rejects more than twenty plans without widening ordinary output limits", () => {
  const items = Array.from({ length: 21 }, (_, i) => ({
    id: crypto.randomUUID(),
    title: `方案${i}`,
    prompt: `独立商品方案${i}`,
  }));
  expect(
    imageGenerationInputSchema.safeParse({
      model: "gpt-image-2.5",
      prompt: "智能裂变",
      count: 21,
      variation: { version: 1, planId: crypto.randomUUID(), items },
    }).success,
  ).toBe(false);
  expect(
    imageGenerationInputSchema.safeParse({ model: "gpt-image-2.5", prompt: "商品摄影", count: 5 })
      .success,
  ).toBe(false);
});

it("accepts count-only planning without weakening the maximum reference count", () => {
  const input = { description: "生成商品图", referenceAssetIds: [] };
  expect(variationPlanInputSchema.parse({ ...input, referenceCount: 2 }).referenceCount).toBe(2);
  for (const referenceCount of [-1, 6, 1.5, "2"])
    expect(variationPlanInputSchema.safeParse({ ...input, referenceCount }).success).toBe(false);
});
