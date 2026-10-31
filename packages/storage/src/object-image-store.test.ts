import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import type { ImageObjectBucket } from "./object-bucket";
import { objectImageStore } from "./object-image-store";

describe("Node cloud image processing", () => {
  const scope = { organizationId: randomUUID(), userId: randomUUID() };
  it("stores private original and display variants without a Cloudflare binding", async () => {
    const saved = new Map<string, Uint8Array>();
    const bucket: ImageObjectBucket = {
      head: async () => null,
      get: async () => null,
      delete: async () => {},
      put: async (key, bytes) => {
        saved.set(key, bytes);
        return { stored: true };
      },
    };
    const input = await sharp({
      create: { width: 1800, height: 900, channels: 3, background: "#A8FF00" },
    })
      .png()
      .toBuffer();
    const asset = await objectImageStore(bucket, async () => "1234567890").put(scope, input);
    expect(saved.size).toBe(4);
    const original = saved.get(asset.objectKey);
    if (!original) throw new Error("Original missing");
    const preview = saved.get(asset.objectKey.replace(/\.png$/, ".preview.webp"));
    if (!preview) throw new Error("Preview missing");
    expect((await sharp(original).metadata()).width).toBe(1800);
    expect((await sharp(preview).metadata()).width).toBe(1600);
    expect(asset.objectKey).toMatch(/^1234567890\//);
  });
  it("retains a paid original when derived-image persistence fails", async () => {
    const put = vi
      .fn<ImageObjectBucket["put"]>()
      .mockResolvedValueOnce({ stored: true })
      .mockRejectedValue(new Error("storage unavailable"));
    const bucket: ImageObjectBucket = {
      head: async () => null,
      get: async () => null,
      delete: vi.fn(),
      put,
    };
    const input = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    await expect(
      objectImageStore(bucket, async () => "1234567890").put(scope, input),
    ).rejects.toThrow("storage unavailable");
    expect(put).toHaveBeenCalledTimes(2);
    expect(bucket.delete).not.toHaveBeenCalled();
  });
});
