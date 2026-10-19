import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
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
