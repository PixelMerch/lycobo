import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import type { ImageObjectBucket } from "./object-bucket";
import { objectImageStore } from "./object-image-store";

describe("Node cloud image processing", () => {
  const scope = { organizationId: randomUUID(), userId: randomUUID() };
  it("stores private original and display variants using the shared object bucket", async () => {
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
    expect(saved.size).toBe(3);
    expect(saved.has(asset.objectKey.replace(/\.png$/, ".thumbnail.png"))).toBe(false);
    const original = saved.get(asset.objectKey);
    if (!original) throw new Error("Original missing");
    const preview = saved.get(asset.objectKey.replace(/\.png$/, ".preview.webp"));
    if (!preview) throw new Error("Preview missing");
    expect((await sharp(original).metadata()).width).toBe(1800);
    expect((await sharp(preview).metadata()).width).toBe(1600);
    expect(asset.objectKey).toMatch(/^1234567890\//);
  });
  it("uploads variants concurrently and retains the paid original when a variant fails", async () => {
    let finishThumbnail = () => {};
    const thumbnail = new Promise<{ stored: true }>((resolve) => {
      finishThumbnail = () => resolve({ stored: true });
    });
    const put = vi
      .fn<ImageObjectBucket["put"]>()
      .mockResolvedValueOnce({ stored: true })
      .mockReturnValueOnce(thumbnail)
      .mockRejectedValueOnce(new Error("storage unavailable"));
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
    const finished = vi.fn();
    const saved = objectImageStore(bucket, async () => "1234567890")
      .put(scope, input)
      .catch(finished);
    try {
      await vi.waitFor(() => expect(put).toHaveBeenCalledTimes(3));
      expect(put.mock.calls.map(([key]) => key.split(".").slice(1).join("."))).toEqual([
        "png",
        "thumbnail.webp",
        "preview.webp",
      ]);
      expect(finished).not.toHaveBeenCalled();
    } finally {
      finishThumbnail();
      await saved;
    }
    expect(finished).toHaveBeenCalledExactlyOnceWith(new Error("storage unavailable"));
    expect(bucket.delete).not.toHaveBeenCalled();
  });
  it("creates the planner PNG thumbnail on first use and reuses it afterwards", async () => {
    const saved = new Map<string, Uint8Array>();
    const bucket: ImageObjectBucket = {
      head: async () => null,
      get: async (key) => {
        const stored = saved.get(key);
        if (!stored) return null;
        const bytes = new Uint8Array(stored);
        return {
          size: bytes.length,
          body: new Blob([bytes]).stream(),
          arrayBuffer: async () => bytes.buffer,
        };
      },
      delete: async () => {},
      put: vi.fn(async (key: string, bytes: Uint8Array) => {
        saved.set(key, bytes);
        return { stored: true };
      }),
    };
    const input = await sharp({
      create: { width: 1200, height: 600, channels: 3, background: "#54E6A5" },
    })
      .png()
      .toBuffer();
    const store = objectImageStore(bucket, async () => "1234567890");
    const asset = await store.put(scope, input);
    const thumbnail = await store.thumbnail(asset);
    expect(await sharp(thumbnail).metadata()).toMatchObject({ format: "png", width: 512 });
    expect(saved.has(asset.objectKey.replace(/\.png$/, ".thumbnail.png"))).toBe(true);
    const writes = vi.mocked(bucket.put).mock.calls.length;
    expect(new Uint8Array(await store.thumbnail(asset))).toEqual(new Uint8Array(thumbnail));
    expect(bucket.put).toHaveBeenCalledTimes(writes);
  });
});
