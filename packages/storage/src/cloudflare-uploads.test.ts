import { createHash } from "node:crypto";
import type { ImageScope, StoredImage } from "@lycoboai/contracts";
import { describe, expect, it, vi } from "vitest";
import { cloudflareUploads } from "./cloudflare-uploads";
import { type ImageStore, ImageValidationError } from "./core";
import type { ImageObjectBucket } from "./object-bucket";

function fixture() {
  const scope = { userId: crypto.randomUUID(), organizationId: crypto.randomUUID() };
  const files = new Map<string, Uint8Array>();
  const assets = new Map<string, StoredImage>();
  const bucket: ImageObjectBucket = {
    async head(key) {
      const value = files.get(key);
      return value ? { size: value.length, httpEtag: "fixture" } : null;
    },
    async get(key) {
      const value = files.get(key);
      if (!value) return null;
      const response = new Response(value);
      return {
        size: value.length,
        body: response.body!,
        arrayBuffer: () => response.arrayBuffer(),
      };
    },
    async put(key, value) {
      files.set(key, value);
    },
    async delete(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) files.delete(key);
    },
  };
  const queue = { send: vi.fn(async (_body: unknown) => undefined) };
  const repository = {
    async asset(owner: ImageScope, id: string) {
      return owner.organizationId === scope.organizationId ? (assets.get(id) ?? null) : null;
    },
    addReference: vi.fn(async (_scope: ImageScope, asset: StoredImage) => {
      assets.set(asset.id, asset);
    }),
  };
  const put = vi.fn<ImageStore["put"]>(async (_owner, bytes, id = crypto.randomUUID()) => ({
    id,
    objectKey: `${id}.png`,
    mimeType: "image/png",
    width: 1,
    height: 1,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  }));
  const store: ImageStore = {
    ready: async () => undefined,
    put,
    read: async () => new Uint8Array(),
    thumbnail: async () => new Uint8Array(),
    remove: async () => undefined,
  };
  return {
    scope,
    files,
    queue,
    repository,
    store,
    put,
    uploads: cloudflareUploads(bucket, queue, repository, store),
  };
}

describe("queued reference upload", () => {
  it("does not register or process an asset in the HTTP enqueue path, and rejects other owners", async () => {
    const f = fixture();
    const id = await f.uploads.enqueue(f.scope, new Uint8Array([1]));
    expect(await f.uploads.status(f.scope, id)).toEqual({ status: "pending" });
    expect(await f.uploads.status({ ...f.scope, userId: crypto.randomUUID() }, id)).toBeNull();
    expect(f.put).not.toHaveBeenCalled();
    expect(f.repository.addReference).not.toHaveBeenCalled();
    await f.uploads.process(id);
    expect((await f.uploads.status(f.scope, id))?.status).toBe("succeeded");
    expect(f.files.has(`_uploads/${id}.bin`)).toBe(false);
    await f.uploads.process(id);
    expect(f.repository.addReference).toHaveBeenCalledOnce();
  });
  it("keeps a durable intent when queue send fails and recovers it", async () => {
    const f = fixture();
    f.queue.send.mockRejectedValueOnce(new Error("offline"));
    const id = await f.uploads.enqueue(f.scope, new Uint8Array([1]));
    await f.uploads.recover(id);
    expect(f.queue.send).toHaveBeenLastCalledWith({ version: 1, uploadId: id });
    expect(f.put).not.toHaveBeenCalled();
  });
  it("retries storage failures without reporting success; invalid images become explicit failures", async () => {
    const f = fixture();
    const id = await f.uploads.enqueue(f.scope, new Uint8Array([1]));
    f.put.mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(f.uploads.process(id)).rejects.toThrow();
    expect((await f.uploads.status(f.scope, id))?.status).toBe("pending");
    f.put.mockRejectedValueOnce(new ImageValidationError("INVALID_IMAGE"));
    await f.uploads.process(id);
    expect(await f.uploads.status(f.scope, id)).toEqual({ status: "failed" });
    expect(f.repository.addReference).not.toHaveBeenCalled();
  });
  it("recovers a committed asset after receipt write fails without encoding again", async () => {
    const f = fixture();
    const id = await f.uploads.enqueue(f.scope, new Uint8Array([1]));
    f.repository.addReference.mockImplementationOnce(async (_owner, asset) => {
      f.repository.addReference.mockImplementation(async () => undefined);
      f.repository.asset = async () => asset;
      throw new Error("connection lost after commit");
    });
    await expect(f.uploads.process(id)).rejects.toThrow();
    await f.uploads.process(id);
    expect(f.put).toHaveBeenCalledOnce();
    expect((await f.uploads.status(f.scope, id))?.status).toBe("succeeded");
  });
});
