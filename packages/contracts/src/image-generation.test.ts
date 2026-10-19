import { describe, expect, it } from "vitest";
import { imageGenerationInputSchema } from "./image-generation";

describe("image submission", () => {
  it("supports text generation without client-supplied identity", () => {
    expect(
      imageGenerationInputSchema.parse({ model: "gpt-image-2", prompt: " hello " }),
    ).toMatchObject({ prompt: "hello", referenceAssetIds: [], count: 1 });
    expect(
      imageGenerationInputSchema.safeParse({
        model: "gpt-image-2",
        prompt: "hello",
        organizationId: crypto.randomUUID(),
      }).success,
    ).toBe(false);
  });
  it("rejects duplicate assets and oversized batches", () => {
    const id = crypto.randomUUID();
    expect(
      imageGenerationInputSchema.safeParse({
        model: "gpt-image-2",
        prompt: "hello",
        referenceAssetIds: [id, id],
      }).success,
    ).toBe(false);
    expect(
      imageGenerationInputSchema.safeParse({ model: "gpt-image-2", prompt: "hello", count: 5 })
        .success,
    ).toBe(false);
  });
});
