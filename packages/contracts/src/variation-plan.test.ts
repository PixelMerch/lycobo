import { expect, it } from "vitest";
import { imageGenerationInputSchema } from "./image-generation";
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
it("allows ten confirmed plans but forbids count mismatch and mixed tools", () => {
  const items = Array.from({ length: 10 }, (_, i) => ({
    id: crypto.randomUUID(),
    title: `商品${i}`,
    prompt: `独立商品摄影方案${i}`,
  }));
  const input = {
    model: "gpt-image-2.5",
    prompt: "智能裂变",
    count: 10,
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
