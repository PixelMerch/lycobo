import { describe, expect, it } from "vitest";
import { userUidSchema } from "../auth/auth";
import {
  assetTypeSchema,
  imageAssetSchema,
  imageGenerationInputSchema,
  imagePublicIdSchema,
  imageTaskPublicIdSchema,
} from "./image-generation";

describe("image submission", () => {
  it("accepts reference roles and plan item bindings only when they match the task", () => {
    const ids = [crypto.randomUUID(), crypto.randomUUID()];
    const base = { model: "gpt-image-2", prompt: "白底主图", referenceAssetIds: ids };
    expect(
      imageGenerationInputSchema.safeParse({ ...base, referenceRoles: ["product", "source"] })
        .success,
    ).toBe(true);
    expect(
      imageGenerationInputSchema.safeParse({ ...base, referenceRoles: ["product"] }).success,
    ).toBe(false);
    const plan = (referenceAssetIds: string[]) => ({
      ...base,
      model: "gpt-image-2.5",
      count: 1,
      variation: {
        version: 1,
        planId: crypto.randomUUID(),
        items: [
          {
            id: crypto.randomUUID(),
            title: "西语版",
            prompt: "把参考图2翻译成西班牙语",
            referenceAssetIds,
          },
        ],
      },
    });
    expect(imageGenerationInputSchema.safeParse(plan([ids[1] ?? ""])).success).toBe(true);
    expect(imageGenerationInputSchema.safeParse(plan([crypto.randomUUID()])).success).toBe(false);
  });
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
  for (const id of ["W00000000", "W9AZ09XYZ"]) expect(imageTaskPublicIdSchema.parse(id)).toBe(id);
  for (const id of ["P00000000", "P9AZ09XYZ"]) expect(imagePublicIdSchema.parse(id)).toBe(id);
  for (const id of ["123", "1000000000", "W9az09XYZ", "W123456789", crypto.randomUUID()])
    expect(imageTaskPublicIdSchema.safeParse(id).success).toBe(false);
  for (const id of ["P123", "P100000000", "P9az09XYZ", "L12345678", crypto.randomUUID()])
    expect(imagePublicIdSchema.safeParse(id).success).toBe(false);
});

it("preserves ten-digit user UIDs including leading zero", () => {
  expect(userUidSchema.parse("0123456789")).toBe("0123456789");
  for (const value of [1234567890, "123456789", "12345678901", "A123456789", crypto.randomUUID()])
    expect(userUidSchema.safeParse(value).success).toBe(false);
});

it("validates persisted local edit lineage and original pixel bounds", () => {
  const source = crypto.randomUUID();
  const region = {
    id: crypto.randomUUID(),
    x: 10,
    y: 20,
    width: 30,
    height: 40,
    prompt: "改为蓝色",
  };
  const input = {
    model: "gpt-image-2",
    prompt: "edit",
    referenceAssetIds: [source],
    localEdit: { sourceAssetId: source, width: 100, height: 100, regions: [region] },
  };
  expect(imageGenerationInputSchema.parse(input).localEdit?.regions).toEqual([region]);
  expect(
    imageGenerationInputSchema.parse({ model: "gpt-image-2", prompt: "legacy" }),
  ).not.toHaveProperty("localEdit");
  for (const invalid of [
    { ...input, count: 2 },
    { ...input, referenceAssetIds: [crypto.randomUUID()] },
    { ...input, localEdit: { ...input.localEdit, regions: [region, region] } },
    { ...input, localEdit: { ...input.localEdit, regions: [{ ...region, x: 90 }] } },
    { ...input, localEdit: { ...input.localEdit, regions: [] } },
  ])
    expect(imageGenerationInputSchema.safeParse(invalid).success).toBe(false);
});

it("separates asset media types from input/output kinds and accepts legacy image metadata", () => {
  expect(assetTypeSchema.options).toEqual(["image", "video", "audio"]);
  expect(assetTypeSchema.safeParse("reference").success).toBe(false);
  expect(imageAssetSchema.shape.type.parse(undefined)).toBe("image");
  expect(imageAssetSchema.shape.type.parse("image")).toBe("image");
  expect(imageAssetSchema.shape.type.safeParse("unknown").success).toBe(false);
});
