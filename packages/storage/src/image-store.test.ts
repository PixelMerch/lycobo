import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  imageStore,
  normalizeImage,
  normalizeReferenceUpload,
  providerReference,
} from "./image-store";

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

it("keeps paid originals pixel-identical while recompressing them", async () => {
  const width = 64,
    height = 48;
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 37 + (i >> 5) * 11) % 256;
  const source = await sharp(pixels, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
  const { data } = await normalizeImage(source);
  const decoded = await sharp(data).raw().toBuffer({ resolveWithObject: true });
  expect((await sharp(data).metadata()).format).toBe("png");
  expect(decoded.info).toMatchObject({ width, height, channels: 3 });
  expect(decoded.data.equals(pixels)).toBe(true);
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
it("sends opaque references as smaller JPEGs of at most 3840 pixels", async () => {
  const photo = await sharp({
    create: {
      width: 4000,
      height: 200,
      channels: 3,
      background: "#808080",
      noise: { type: "gaussian", mean: 128, sigma: 24 },
    },
  })
    .png()
    .toBuffer();
  const sent = await providerReference(photo);
  expect(sent.length).toBeLessThan(photo.length);
  expect(await sharp(sent).metadata()).toMatchObject({ format: "jpeg", width: 3840, height: 192 });
});
it("keeps transparent references as PNG and returns bytes it cannot improve unchanged", async () => {
  // Noisy alpha: a JPEG would be smaller, so only the transparency check keeps it PNG.
  const cutout = await sharp({
    create: {
      width: 900,
      height: 600,
      channels: 4,
      background: { r: 84, g: 230, b: 165, alpha: 0.5 },
      noise: { type: "gaussian", mean: 128, sigma: 40 },
    },
  })
    .png()
    .toBuffer();
  expect(await sharp(await providerReference(cutout)).metadata()).toMatchObject({
    format: "png",
    hasAlpha: true,
  });
  // A 2x2 PNG is smaller than any JPEG of it; undecodable bytes are passed through.
  expect(await providerReference(png)).toBe(png);
  const broken = new Uint8Array([1, 2, 3]);
  expect(await providerReference(broken)).toBe(broken);
});

it("preserves provider-aligned output without padding or upscaling", async () => {
  const source = await sharp({
    create: { width: 704, height: 1248, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  expect(await normalizeImage(source, { width: 705, height: 1254 })).toMatchObject({
    width: 704,
    height: 1248,
  });
  await expect(normalizeImage(source, { width: 720, height: 1280 })).rejects.toThrow(
    "OUTPUT_RESOLUTION_TOO_SMALL",
  );
});
it("bounds uploaded reference dimensions and preserves small originals", async () => {
  const source = await sharp({
    create: { width: 2000, height: 4000, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  expect(await sharp(await normalizeReferenceUpload(source)).metadata()).toMatchObject({
    width: 1920,
    height: 3840,
  });
  expect(await sharp(await normalizeReferenceUpload(png)).metadata()).toMatchObject({
    width: 2,
    height: 2,
  });
  await expect(normalizeReferenceUpload(Buffer.from("invalid"))).rejects.toThrow("INVALID_IMAGE");
});
