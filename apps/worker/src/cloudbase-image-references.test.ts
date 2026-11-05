import { createHash, randomUUID } from "node:crypto";
import type { StoredImage } from "@lycoboai/contracts";
import { expect, it, vi } from "vitest";
import { cloudbaseImageReferences } from "./cloudbase-image-references";

function reference(bytes: Uint8Array): StoredImage {
  const id = randomUUID();
  return {
    id,
    objectKey: `1234567890/${randomUUID()}/${id}.png`,
    mimeType: "image/png",
    bytes: bytes.length,
    width: 1,
    height: 1,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

it("uploads one JPEG derivative per original, even with concurrent items", async () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 1]);
  const asset = reference(new Uint8Array([1, 2, 3]));
  const objects = new Map<string, number>();
  const bucket = {
    head: vi.fn(async (key: string) => {
      const size = objects.get(key);
      return size ? { size, httpEtag: "fixture" } : null;
    }),
    put: vi.fn(async (key: string, bytes: Uint8Array) => {
      objects.set(key, bytes.length);
    }),
  };
  const store = { read: vi.fn(async () => jpeg) };
  const sign = vi.fn(
    async (key: string) => new URL(`https://private.example/${key}?token=fixture`),
  );
  const deliver = cloudbaseImageReferences(bucket, store, sign);
  const [first, second] = await Promise.all([deliver(asset, false), deliver(asset, false)]);
  expect(first).toEqual(second);
  expect(bucket.put).toHaveBeenCalledExactlyOnceWith(`${asset.objectKey}.provider-v1.jpg`, jpeg, {
    httpMetadata: { contentType: "image/jpeg" },
  });
  expect(sign).toHaveBeenCalledOnce();
  const nextDrain = cloudbaseImageReferences(bucket, store, sign);
  expect(await nextDrain(asset, false)).toEqual(first);
  expect(store.read).toHaveBeenCalledOnce();
  expect(bucket.put).toHaveBeenCalledOnce();
  expect((await nextDrain(asset, true)).pathname).toBe(`/${asset.objectKey}`);
});
