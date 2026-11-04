import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cloudbaseDownloadSigner,
  cloudbaseObjectBucket,
  cloudbasePlaybackSigner,
  cloudbaseProviderReferenceSigner,
  readCloudBaseStorageConfig,
} from "./cloudbase-object-bucket";
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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    expect(await imageObjectBucket(env).get("a.png")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(() => imageObjectBucket({ CLOUDBASE_ENV_ID: env.CLOUDBASE_ENV_ID })).toThrow();
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

it("signs a bounded original download without exposing the service credential", async () => {
  const path = "/v1/storages/object/sign/private-images/a.png";
  const signed = `https://fixture-env-123.api.tcloudbasegateway.com${path}?token=temporary`;
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify({ fullSignedURL: signed })));
  const sign = cloudbaseDownloadSigner(env, request);
  const url = new URL(await sign("a.png", 120));
  expect(url.searchParams.get("download")).toBe("a.png");
  expect(url.href).not.toContain(env.CLOUDBASE_APIKEY);
  expect(request.mock.calls[0]?.[0]).toBe(signed.split("?")[0]);
  expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toEqual({ expiresIn: 120 });
  expect(request.mock.calls[0]?.[1]?.redirect).toBe("manual");
  await expect(sign("a.png", 301)).rejects.toThrow("INVALID_DOWNLOAD_LIFETIME");
  for (const fullSignedURL of [
    "https://evil.test/a.png?token=x",
    signed.replace("a.png", "other.png"),
    signed.replace("https:", "http:"),
  ]) {
    request.mockResolvedValue(new Response(JSON.stringify({ fullSignedURL })));
    await expect(sign("a.png", 120)).rejects.toThrow("IMAGE_STORAGE_UNAVAILABLE");
  }
  request.mockResolvedValue(new Response("secret upstream body", { status: 403 }));
  await expect(sign("a.png", 120)).rejects.toThrow("IMAGE_STORAGE_UNAVAILABLE");
});

it("signs inline playback links for the exact object with a bounded lifetime", async () => {
  const signed =
    "https://fixture-env-123.api.tcloudbasegateway.com/v1/storages/object/sign/private-images/a.mp4?token=temporary";
  const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ fullSignedURL: signed }));
  const sign = cloudbasePlaybackSigner(env, request);
  const url = new URL(await sign("a.mp4", 900));
  expect(url.searchParams.get("token")).toBe("temporary");
  expect(url.searchParams.has("download")).toBe(false);
  expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toEqual({ expiresIn: 900 });
  await expect(sign("a.mp4", 901)).rejects.toThrow("INVALID_DOWNLOAD_LIFETIME");
  request.mockResolvedValue(Response.json({ fullSignedURL: signed.replace("a.mp4", "b.mp4") }));
  await expect(sign("a.mp4", 900)).rejects.toThrow("IMAGE_STORAGE_UNAVAILABLE");
});

it("signs private reference images for the provider without requiring an asset host", async () => {
  const signed =
    "https://fixture-env-123.api.tcloudbasegateway.com/v1/storages/object/sign/private-images/a.png?token=temporary";
  const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ fullSignedURL: signed }));
  const sign = cloudbaseProviderReferenceSigner(env, request);
  expect(new URL(await sign("a.png")).searchParams.has("download")).toBe(false);
  expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toEqual({ expiresIn: 3600 });
  expect(() => sign("a.mp4")).toThrow("INVALID_REFERENCE_IMAGE");
});
it("stores videos larger than the image limit in the same private bucket", async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null));
  const bucket = cloudbaseObjectBucket(env, request);
  const bytes = new Uint8Array(33 * 1024 * 1024);
  await expect(
    bucket.put("a.mp4", bytes, { httpMetadata: { contentType: "video/mp4" } }),
  ).resolves.toEqual({ stored: true });
  await expect(bucket.put("a.png", bytes)).rejects.toThrow("INVALID_IMAGE_SIZE");
});
