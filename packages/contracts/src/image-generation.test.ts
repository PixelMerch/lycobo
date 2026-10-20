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
  it("validates quality and leaves legacy snapshots unchanged", () => {
    const legacy = { model: "gpt-image-2", prompt: "hello" };
    expect(imageGenerationInputSchema.parse(legacy)).not.toHaveProperty("quality");
    for (const quality of ["low", "medium", "high"]) {
      expect(imageGenerationInputSchema.parse({ ...legacy, quality }).quality).toBe(quality);
    }
    for (const quality of ["auto", "标准", "", null, 1]) {
      expect(imageGenerationInputSchema.safeParse({ ...legacy, quality }).success).toBe(false);
    }
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
