import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { copyStorageObject, storageMigrationError } from "../apps/api/scripts/storage-copy";
import { createCopyManifest } from "../apps/api/scripts/storage-copy-manifest";

const content = new TextEncoder().encode("private migration fixture");
const hash = createHash("sha256").update(content).digest("hex");
const key = `0057849613/${randomUUID()}/${randomUUID()}.png`;
const asset = {
  id: randomUUID(),
  object_key: key,
  media_type: "image",
  mime_type: "image/png",
  bytes: content.length,
  sha256: hash,
  storage_deleted_at: null,
};
const entry = {
  key,
  assetId: asset.id,
  kind: "original",
  mimeType: "image/png",
  expectedBytes: content.length,
  expectedSha256: hash,
};

function memoryBucket(initial = []) {
  const objects = new Map(initial);
  return {
    get: vi.fn(async (objectKey) => {
      const bytes = objects.get(objectKey);
      if (!bytes) return null;
      const value = Uint8Array.from(bytes);
      return {
        size: value.length,
        body: new Blob([value]).stream(),
        arrayBuffer: async () => value.buffer,
      };
    }),
    put: vi.fn(async (objectKey, bytes) => {
      objects.set(objectKey, Uint8Array.from(bytes));
    }),
  };
}

describe("storage migration", () => {
  it("copies exact content and verifies the destination, then resumes without rewriting", async () => {
    const source = memoryBucket([[key, content]]);
    const target = memoryBucket();
    expect(await copyStorageObject(source, target, entry)).toEqual({
      key,
      status: "copied",
      bytes: content.length,
      sha256: hash,
    });
    expect((await copyStorageObject(source, target, entry)).status).toBe("existing");
    expect(target.put).toHaveBeenCalledTimes(1);
    expect(source.put).not.toHaveBeenCalled();
  });

  it("rejects a source hash mismatch before writing", async () => {
    const target = memoryBucket();
    await expect(
      copyStorageObject(memoryBucket([[key, content]]), target, {
        ...entry,
        expectedSha256: "0".repeat(64),
      }),
    ).rejects.toThrow("SOURCE_CONTENT_MISMATCH");
    expect(target.put).not.toHaveBeenCalled();
  });

  it("rechecks completed target bytes on resume without downloading the source again", async () => {
    const source = memoryBucket();
    const target = memoryBucket([[key, content]]);
    const checkpoint = { key, status: "copied", bytes: content.length, sha256: hash };
    expect((await copyStorageObject(source, target, entry, checkpoint)).status).toBe("existing");
    expect(source.get).not.toHaveBeenCalled();
    await target.put(key, new Uint8Array([0]));
    await expect(copyStorageObject(source, target, entry, checkpoint)).rejects.toThrow(
      "TARGET_CONTENT_CONFLICT",
    );
  });

  it("does not overwrite an existing object with different content", async () => {
    const target = memoryBucket([[key, new Uint8Array([1])]]);
    await expect(copyStorageObject(memoryBucket([[key, content]]), target, entry)).rejects.toThrow(
      "TARGET_CONTENT_CONFLICT",
    );
    expect(target.put).not.toHaveBeenCalled();
  });

  it("recovers a completed upload whose first verification request failed", async () => {
    const target = memoryBucket();
    target.get
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("IMAGE_STORAGE_UNAVAILABLE"));
    const source = memoryBucket([[key, content]]);
    await expect(copyStorageObject(source, target, entry)).rejects.toThrow(
      "IMAGE_STORAGE_UNAVAILABLE",
    );
    expect((await copyStorageObject(source, target, entry)).status).toBe("existing");
    expect(target.put).toHaveBeenCalledTimes(1);
  });

  it("excludes deleted assets, unrelated objects and absent optional derivatives", () => {
    const deleted = {
      ...asset,
      id: randomUUID(),
      object_key: "deleted.png",
      storage_deleted_at: "2026-11-05",
    };
    const preview = key.replace(/\.png$/, ".preview.webp");
    const manifest = createCopyManifest(
      [asset, deleted],
      new Set([key, preview, "unrelated.png", "deleted.png"]),
    );
    expect(manifest.entries.map((item) => item.key)).toEqual([key, preview]);
    expect(manifest.deletedAssets).toBe(1);
    expect(manifest.missingOriginals).toEqual([]);
    expect(createCopyManifest([asset], new Set()).missingOriginals).toEqual([asset.id]);
  });

  it("never exposes arbitrary credential-bearing error messages", () => {
    expect(storageMigrationError(new Error("postgresql://user:secret@example.com"))).toBe(
      "STORAGE_MIGRATION_UNAVAILABLE",
    );
  });
});
