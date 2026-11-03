import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { expect, it, vi } from "vitest";
import type { ImageObjectBucket } from "./object-bucket";
import { videoDimensions } from "./video-media";
import { videoVariantCache, videoVariantKey } from "./video-variants";

const key =
  "0057849613/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002.mp4";
it("extracts a real WebP cover and H264 preview, preserves the original and coalesces requests", async () => {
  const original = new Uint8Array(
    await readFile(new URL("../../../tests/fixtures/video-portrait.mp4", import.meta.url)),
  );
  const objects = new Map<string, Uint8Array>([[key, original]]);
  const get = vi.fn(async (id: string) => {
    const bytes = objects.get(id);
    return bytes
      ? {
          size: bytes.length,
          arrayBuffer: async () => new Uint8Array(bytes).buffer,
          body: new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(bytes);
              controller.close();
            },
          }),
        }
      : null;
  });
  const bucket: ImageObjectBucket = {
    get,
    head: async (id) =>
      objects.has(id) ? { size: objects.get(id)?.length ?? 0, httpEtag: "fixture" } : null,
    put: async (id, bytes) => {
      objects.set(id, new Uint8Array(bytes));
    },
    delete: async () => {},
  };
  const create = videoVariantCache(bucket);
  await Promise.all([create(key, "thumbnail"), create(key, "thumbnail")]);
  const cover = objects.get(videoVariantKey(key, "thumbnail"));
  expect(cover).toBeDefined();
  expect((await sharp(cover).metadata()).format).toBe("webp");
  expect(get).toHaveBeenCalledTimes(1);
  await create(key, "preview");
  const preview = objects.get(videoVariantKey(key, "preview"));
  expect(preview).toBeDefined();
  if (!preview) throw new Error("Missing preview");
  expect(videoDimensions(preview)).toEqual({ width: 90, height: 162 });
  expect(objects.get(key)).toEqual(original);
  await create(key, "preview");
  expect(get).toHaveBeenCalledTimes(2);
  await expect(create("../outside.mp4", "thumbnail")).rejects.toThrow("INVALID_VIDEO_KEY");
}, 45000);
