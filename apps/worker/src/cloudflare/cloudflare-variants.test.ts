import type { StoredImage } from "@lycoboai/contracts";
import { cloudflareImages } from "@lycoboai/storage/cloudflare";
import { displayObjectKey } from "@lycoboai/storage/variants";
import { expect, it, vi } from "vitest";
import { processCloudflareVariants } from "./cloudflare-variants";

vi.mock("@lycoboai/storage/cloudflare", () => ({ cloudflareImages: vi.fn() }));

function fixture(width = 320, height = 480) {
  const asset: StoredImage = {
    id: crypto.randomUUID(),
    objectKey:
      "1234567890/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002.png",
    mimeType: "image/png",
    bytes: 3,
    width,
    height,
    sha256: "a".repeat(64),
  };
  const bytes = new Uint8Array([1, 2, 3]);
  const encoded = new Uint8Array([4, 5]);
  const objects = new Map<string, Uint8Array>();
  const codec = {
    info: vi.fn(async () => ({ format: "png", width, height, fileSize: bytes.length })),
    encode: vi.fn(async () => encoded),
    reference: vi.fn(async () => bytes),
  };
  vi.mocked(cloudflareImages).mockReturnValue(codec);
  const runtime = {
    repository: { asset: vi.fn<() => Promise<StoredImage | null>>(async () => asset) },
    store: { read: vi.fn(async () => bytes) },
    bucket: {
      head: vi.fn(async (key: string) =>
        objects.has(key) ? { size: 2, httpEtag: "fixture" } : null,
      ),
      put: vi.fn(async (key: string, data: Uint8Array) => {
        objects.set(key, data);
      }),
    },
  };
  const env = { IMAGES: { info: vi.fn(), input: vi.fn() } };
  const job = { assetId: asset.id, organizationId: crypto.randomUUID() };
  return { asset, bytes, encoded, objects, codec, runtime, env, job };
}

it("repairs both small display variants with one transformation and skips redelivery", async () => {
  const f = fixture();
  await processCloudflareVariants(f.job, f.env, f.runtime);
  expect(f.codec.info).toHaveBeenCalledTimes(1);
  expect(f.codec.encode).toHaveBeenCalledExactlyOnceWith(f.bytes, 1600, 1600, "image/webp", 82);
  expect(f.objects.get(displayObjectKey(f.asset.objectKey, "thumbnail"))).toBe(f.encoded);
  expect(f.objects.get(displayObjectKey(f.asset.objectKey, "preview"))).toBe(f.encoded);
  expect(f.objects.has(f.asset.objectKey)).toBe(false);
  await processCloudflareVariants(f.job, f.env, f.runtime);
  expect(f.runtime.store.read).toHaveBeenCalledTimes(1);
  expect(f.codec.info).toHaveBeenCalledTimes(1);
  expect(f.codec.encode).toHaveBeenCalledTimes(1);
  expect(f.runtime.bucket.put).toHaveBeenCalledTimes(2);
});

it("keeps distinct sizes and quality for larger images", async () => {
  const f = fixture(512, 513);
  await processCloudflareVariants(f.job, f.env, f.runtime);
  expect(f.codec.encode).toHaveBeenCalledTimes(2);
  expect(f.codec.encode).toHaveBeenCalledWith(f.bytes, 512, 512, "image/webp", 76);
  expect(f.codec.encode).toHaveBeenCalledWith(f.bytes, 1600, 1600, "image/webp", 82);
});

it("repairs only the missing object and preserves an existing variant", async () => {
  const f = fixture();
  const thumbnail = displayObjectKey(f.asset.objectKey, "thumbnail");
  f.objects.set(thumbnail, f.bytes);
  await processCloudflareVariants(f.job, f.env, f.runtime);
  expect(f.objects.get(thumbnail)).toBe(f.bytes);
  expect(f.codec.encode).toHaveBeenCalledTimes(1);
  expect(f.runtime.bucket.put).toHaveBeenCalledTimes(1);
});

it("checks organization ownership before any object or image operation", async () => {
  const f = fixture();
  f.runtime.repository.asset.mockResolvedValue(null);
  await processCloudflareVariants(f.job, f.env, f.runtime);
  expect(f.runtime.repository.asset).toHaveBeenCalledWith(
    { organizationId: f.job.organizationId, userId: f.job.organizationId },
    f.job.assetId,
  );
  expect(f.runtime.bucket.head).not.toHaveBeenCalled();
  expect(f.runtime.store.read).not.toHaveBeenCalled();
  expect(f.codec.encode).not.toHaveBeenCalled();
});

it("retries a failed write without overwriting the variant already saved", async () => {
  const f = fixture();
  f.runtime.bucket.put.mockImplementationOnce(async (key, data) => {
    f.objects.set(key, data);
  });
  f.runtime.bucket.put.mockRejectedValueOnce(new Error("R2_UNAVAILABLE"));
  await expect(processCloudflareVariants(f.job, f.env, f.runtime)).rejects.toThrow(
    "R2_UNAVAILABLE",
  );
  expect(f.objects.size).toBe(1);
  await processCloudflareVariants(f.job, f.env, f.runtime);
  expect(f.objects.size).toBe(2);
  expect(f.codec.encode).toHaveBeenCalledTimes(2);
  expect(f.runtime.bucket.put).toHaveBeenCalledTimes(3);
});
