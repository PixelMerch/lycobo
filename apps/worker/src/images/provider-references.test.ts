import { imageGenerationInputSchema, type StoredImage } from "@lycoboai/contracts";
import type { ClaimedImage } from "@lycoboai/db";
import { expect, it, vi } from "vitest";
import { mapProviderReferences, providerReferenceBytes } from "./provider-references";

const asset = (): StoredImage => ({
  id: crypto.randomUUID(),
  objectKey: "fixture.png",
  mimeType: "image/png",
  bytes: 3,
  width: 1,
  height: 1,
  sha256: "a".repeat(64),
});
it("sends a local-edit source exactly and reads other references once per instance", async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const store = { read: vi.fn(async () => bytes) };
  const reference = asset();
  expect(await providerReferenceBytes(store, reference, true)).toBe(bytes);
  // 无法解码的测试字节经过重新编码后原样返回。
  expect(await providerReferenceBytes(store, reference, false)).toBe(bytes);
  expect(await providerReferenceBytes(store, reference, false)).toBe(bytes);
  expect(store.read).toHaveBeenCalledTimes(2);
});
it("reads a reference again after a failed storage read", async () => {
  const store = {
    read: vi
      .fn<() => Promise<Uint8Array>>()
      .mockRejectedValueOnce(new Error("IMAGE_STORAGE_UNAVAILABLE"))
      .mockResolvedValue(new Uint8Array([1])),
  };
  const reference = asset();
  await expect(providerReferenceBytes(store, reference, false)).rejects.toThrow(
    "IMAGE_STORAGE_UNAVAILABLE",
  );
  expect(await providerReferenceBytes(store, reference, false)).toEqual(new Uint8Array([1]));
  expect(store.read).toHaveBeenCalledTimes(2);
});
it("reads only the images bound to a plan item and keeps legacy items on every image", async () => {
  const [product, sourceA, sourceB] = [asset(), asset(), asset()];
  const stored = new Map([product, sourceA, sourceB].map((image) => [image.id, image]));
  const repository = {
    asset: vi.fn(async (_scope: unknown, id: string) => stored.get(id) ?? null),
  };
  const item = (prompt: string, referenceAssetIds?: string[]) => ({
    id: crypto.randomUUID(),
    title: "西语版",
    prompt,
    ...(referenceAssetIds ? { referenceAssetIds } : {}),
  });
  const input = imageGenerationInputSchema.parse({
    model: "gpt-image-2.5",
    prompt: "把每张详情图翻译成西班牙语",
    count: 2,
    referenceAssetIds: [product.id, sourceA.id, sourceB.id],
    referenceRoles: ["product", "source", "source"],
    variation: {
      version: 1,
      planId: crypto.randomUUID(),
      items: [item("把参考图2翻译", [sourceA.id, product.id]), item("把参考图3翻译")],
    },
  });
  const job = (position: number): ClaimedImage => ({
    itemId: crypto.randomUUID(),
    position,
    jobId: crypto.randomUUID(),
    organizationId: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    executionToken: crypto.randomUUID(),
    input,
    providerModel: input.model,
  });
  const ids = (position: number) =>
    mapProviderReferences(job(position), repository, async (image) => image.id);
  expect(await ids(0)).toEqual([product.id, sourceA.id]);
  expect(await ids(1)).toEqual([product.id, sourceA.id, sourceB.id]);
});
