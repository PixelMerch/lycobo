import { expect, it } from "vitest";
import { imageGenerationInputSchema } from "./image-generation";

const input = {
  model: "gpt-image-2.6",
  prompt: "match style",
  replica: true,
  referenceAssetIds: [crypto.randomUUID(), crypto.randomUUID()],
  referenceRoles: ["style", "product"],
};
it("requires separate style and product images in the declared order", () => {
  expect(imageGenerationInputSchema.safeParse(input).success).toBe(true);
  for (const patch of [
    { referenceRoles: ["product", "style"] },
    { referenceAssetIds: input.referenceAssetIds.slice(0, 1) },
    { referenceAssetIds: [input.referenceAssetIds[0], input.referenceAssetIds[0]] },
    { referenceRoles: undefined },
  ])
    expect(imageGenerationInputSchema.safeParse({ ...input, ...patch }).success).toBe(false);
});
it("keeps the marker absent from existing ordinary submissions", () => {
  expect(
    imageGenerationInputSchema.parse({ model: input.model, prompt: input.prompt }),
  ).not.toHaveProperty("replica");
});
