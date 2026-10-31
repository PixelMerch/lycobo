import { afterEach, describe, expect, it, vi } from "vitest";
import { cloudbaseObjectBucket, readCloudBaseStorageConfig } from "./cloudbase-object-bucket";
import { imageObjectBucket } from "./s3-object-bucket";

const env = {
  CLOUDBASE_ENV_ID: "fixture-env-123",
  CLOUDBASE_STORAGE_BUCKET: "private-images",
  CLOUDBASE_APIKEY: "fixture-server-key",
};
afterEach(() => vi.unstubAllGlobals());
describe("CloudBase private storage", () => {
  it("requires complete server configuration and does not expose configuration values", () => {
    expect(readCloudBaseStorageConfig({})).toBeNull();
    expect(() => readCloudBaseStorageConfig({ CLOUDBASE_APIKEY: "private-value" })).toThrow(
      "CLOUDBASE_STORAGE_NOT_CONFIGURED",
    );
    expect(() => cloudbaseObjectBucket({ ...env, CLOUDBASE_ENV_ID: "host/elsewhere" })).toThrow();
  });
  it("uses private PG object paths, encodes keys, and does not follow credential redirects", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "Content-Length": "3", ETag: '"fixture"' },
      }),
    );
    const result = await cloudbaseObjectBucket(env, request).get("123/a b.png");
    if (!result) throw new Error("Expected stored object");
    expect(new Uint8Array(await result.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    const [url, init] = request.mock.calls[0] ?? [];
    expect(url).toBe(
      "https://fixture-env-123.api.tcloudbasegateway.com/v1/storages/object/private-images/123/a%20b.png",
    );
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer fixture-server-key");
    expect(init?.redirect).toBe("manual");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
  it("rejects errors without returning provider bodies or reverting to legacy storage", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("private error", { status: 503 }));
    await expect(cloudbaseObjectBucket(env, request).get("a.png")).rejects.toThrow(
      "IMAGE_STORAGE_UNAVAILABLE",
    );
    expect(request).toHaveBeenCalledTimes(1);
    const fallback = { get: vi.fn(), head: vi.fn(), put: vi.fn(), delete: vi.fn() };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    expect(await imageObjectBucket(env, fallback).get("a.png")).toBeNull();
    expect(fallback.get).not.toHaveBeenCalled();
    expect(() => imageObjectBucket({ CLOUDBASE_ENV_ID: env.CLOUDBASE_ENV_ID }, fallback)).toThrow();
  });
  it("validates object keys and download size before exposing a stream", async () => {
    const request = vi.fn<typeof fetch>();
    await expect(cloudbaseObjectBucket(env, request).get("../private")).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
    request.mockResolvedValue(
      new Response("oversized", { headers: { "Content-Length": "999999999" } }),
    );
    await expect(cloudbaseObjectBucket(env, request).get("a.png")).rejects.toThrow(
      "IMAGE_STORAGE_UNAVAILABLE",
    );
  });
  it("uploads idempotently and handles missing deletes without touching legacy copies", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null));
    const bucket = cloudbaseObjectBucket(env, request);
    await bucket.put("a.png", new Uint8Array([1]), { httpMetadata: { contentType: "image/png" } });
    const headers = new Headers(request.mock.calls[0]?.[1]?.headers);
    expect(headers.get("Content-Type")).toBe("image/png");
    expect(headers.get("Content-Length")).toBe("1");
    expect(headers.get("x-upsert")).toBe("true");
    request.mockResolvedValue(new Response(null, { status: 404 }));
    await expect(bucket.delete(["a.png", "b.png"])).resolves.toBeUndefined();
  });
});
