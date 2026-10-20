import { describe, expect, it } from "vitest";
import {
  imageGenerationInputSchema,
  imagePublicIdSchema,
  imageTaskPublicIdSchema,
} from "./image-generation";

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

it("validates fixed-width task and image display IDs", () => {
  for (const id of ["1000000000", "9999999999"]) expect(imageTaskPublicIdSchema.parse(id)).toBe(id);
  for (const id of ["L100000000", "L999999999"]) expect(imagePublicIdSchema.parse(id)).toBe(id);
  for (const id of ["123", "10000000000", "L100000000", crypto.randomUUID()])
    expect(imageTaskPublicIdSchema.safeParse(id).success).toBe(false);
  for (const id of ["P100000000", "L123", "L1000000000", crypto.randomUUID()])
    expect(imagePublicIdSchema.safeParse(id).success).toBe(false);
});
