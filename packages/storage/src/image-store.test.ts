import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { imageStore, normalizeImage } from "./image-store";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADklEQVQImWP4DwYMEAoAU7oL9W/sIDEAAAAASUVORK5CYII=",
  "base64",
);
describe("private image storage", () => {
  it("rejects forged, animated and truncated image data", async () => {
    await expect(normalizeImage(Buffer.from("<svg/>"))).rejects.toThrow("INVALID_IMAGE");
    await expect(normalizeImage(png.subarray(0, 24))).rejects.toThrow("INVALID_IMAGE");
  });
  it("persists sanitized PNGs with actual dimensions, hash and scoped keys", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "lycobo-storage-"));
    try {
      const store = imageStore(root),
        scope = { userId: crypto.randomUUID(), organizationId: crypto.randomUUID() };
      const asset = await store.put(scope, png);
      expect(asset).toMatchObject({ width: 2, height: 2, mimeType: "image/png" });
      expect(asset.objectKey.startsWith(`${scope.organizationId}/${scope.userId}/`)).toBe(true);
      expect(asset.sha256).toHaveLength(64);
      expect(await store.read(asset)).toBeInstanceOf(Buffer);
      expect(() => store.read({ ...asset, objectKey: "../private" })).toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

it("normalizes larger paid output to exact 1254 pixels and rejects smaller sources instead of upscaling", async () => {
  const source = await sharp({
    create: { width: 1536, height: 1536, channels: 3, background: "#789abc" },
  })
    .png()
    .toBuffer();
  const target = { width: 1254, height: 1254 };
  const image = await normalizeImage(source, target);
  expect([image.width, image.height]).toEqual([1254, 1254]);
  await expect(normalizeImage(png, target)).rejects.toThrow("OUTPUT_RESOLUTION_TOO_SMALL");
});
