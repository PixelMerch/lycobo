import { servePrivateAsset } from "@lycoboai/storage/asset-server";
import type { ImageObjectBucket } from "@lycoboai/storage/bucket";
import { assetDeliverySigner } from "@lycoboai/storage/delivery";
import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";

const secret = "fixture-only-asset-signing-secret-0001";
const origin = "https://app.example.test";
const key = `0057849613/${crypto.randomUUID()}/${crypto.randomUUID()}.png`;
const objects = new Map<string, Uint8Array>();
const bucket: ImageObjectBucket = {
  head: async (key) => {
    const b = objects.get(key);
    return b ? { size: b.length, httpEtag: '"fixture"' } : null;
  },
  get: async (key) => {
    const b = objects.get(key);
    return b
      ? {
          size: b.length,
          body: new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(b);
              controller.close();
            },
          }),
          arrayBuffer: async () => new Uint8Array(b).buffer,
        }
      : null;
  },
  put: async (key, bytes) => {
    objects.set(key, bytes);
    return { stored: true };
  },
  delete: async (keys) => {
    for (const key of typeof keys === "string" ? [keys] : keys) objects.delete(key);
  },
};
beforeAll(async () => {
  await bucket.put(key, new TextEncoder().encode("original fixture"));
  await bucket.put(
    key.replace(/\.png$/, ".preview.webp"),
    new TextEncoder().encode("preview fixture"),
  );
  await bucket.put(
    key.replace(/\.png$/, ".thumbnail.webp"),
    new TextEncoder().encode("thumbnail fixture"),
  );
});
function fixture(processor = false) {
  const get = vi.fn(bucket.get.bind(bucket));
  const head = vi.fn(bucket.head.bind(bucket));
  const entries = new Map<string, Response>();
  const cache = {
    match: vi.fn(async (request: Request) => entries.get(request.url)?.clone()),
    put: vi.fn(async (request: Request, response: Response) => {
      entries.set(request.url, new Response(await response.arrayBuffer(), response));
    }),
  };
  const work: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (promise: Promise<unknown>) => {
      work.push(promise);
    },
  };
  const request = (
    url: string,
    headers: ConstructorParameters<typeof Headers>[0] = {
      Referer: `${origin}/create`,
      Origin: origin,
    },
    method = "GET",
  ) =>
    servePrivateAsset(new Request(url, { headers, method }), {
      bucket: { ...bucket, get, head },
      signingSecret: secret,
      allowedOrigins: origin,
      cache,
      background: ctx.waitUntil,
      ...(processor
        ? {
            createVariant: async (body: ReadableStream) =>
              new Uint8Array(
                await sharp(Buffer.from(await new Response(body).arrayBuffer()))
                  .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
                  .webp()
                  .toBuffer(),
              ),
          }
        : {}),
    });
  return { request, cache, get, head, work };
}
describe("private asset edge delivery", () => {
  it("serves original/thumbnail streams, reuses cached objects and verifies before cache", async () => {
    const f = fixture();
    const links = await assetDeliverySigner("https://assets.example.test", secret)(key);
    const first = await f.request(links.url);
    expect(first.headers.get("X-Asset-Cache")).toBe("MISS");
    expect(first.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(first.headers.get("Cache-Control")).toContain("private");
    expect(first.headers.get("Content-Type")).toBe("image/webp");
    expect(await first.text()).toBe("preview fixture");
    await Promise.all(f.work);
    const second = await f.request(links.url);
    expect(second.headers.get("X-Asset-Cache")).toBe("HIT");
    expect(await second.text()).toBe("preview fixture");
    expect(f.get).toHaveBeenCalledTimes(1);
    const download = await f.request(links.download_url);
    expect(download.headers.get("Content-Type")).toBe("image/png");
    expect(download.headers.get("Content-Disposition")).toContain("attachment");
    expect(await download.text()).toBe("original fixture");
    const thumb = await f.request(links.thumbnail_url);
    expect(await thumb.text()).toBe("thumbnail fixture");
    const lookups = f.cache.match.mock.calls.length;
    const invalid = new URL(links.url);
    invalid.searchParams.set("sig", "invalid");
    expect((await f.request(invalid.href)).status).toBe(403);
    expect(f.cache.match).toHaveBeenCalledTimes(lookups);
    expect((await f.request(links.url, { Referer: "https://evil.example/" })).status).toBe(403);
    expect((await f.request(links.url, { Referer: `${origin}.evil.example/` })).status).toBe(403);
    expect((await f.request(links.url, { Origin: "https://evil.example" })).status).toBe(403);
    expect((await f.request(links.url, {}, "POST")).status).toBe(405);
  });
  it("does not generate missing thumbnails or fetch bodies for HEAD", async () => {
    const f = fixture();
    const links = await assetDeliverySigner("https://assets.example.test", secret)(key);
    const head = await f.request(links.url, { Referer: `${origin}/create` }, "HEAD");
    expect(head.status).toBe(200);
    expect(head.body).toBeNull();
    expect(f.get).not.toHaveBeenCalled();
    expect(f.head).toHaveBeenCalledTimes(1);
    expect(f.cache.put).not.toHaveBeenCalled();
    const absent = await assetDeliverySigner(
      "https://assets.example.test",
      secret,
    )(key.replace(/[^/]+\.png$/, `${crypto.randomUUID()}.png`));
    expect((await f.request(absent.thumbnail_url)).status).toBe(404);
  });
});

it("backfills a WebP preview for an existing original instead of returning original bytes", async () => {
  const png = Uint8Array.from(
    atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADklEQVQImWP4DwYMEAoAU7oL9W/sIDEAAAAASUVORK5CYII=",
    ),
    (c) => c.charCodeAt(0),
  );
  const legacyKey = key.replace(/[^/]+\.png$/, `${crypto.randomUUID()}.png`);
  await bucket.put(legacyKey, png);
  const f = fixture(true);
  const links = await assetDeliverySigner("https://assets.example.test", secret)(legacyKey);
  const preview = await f.request(links.url);
  expect(preview.status).toBe(200);
  expect(preview.headers.get("Content-Type")).toBe("image/webp");
  const bytes = new Uint8Array(await preview.arrayBuffer());
  expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("RIFF");
  expect(await bucket.head(legacyKey.replace(/\.png$/, ".preview.webp"))).not.toBeNull();
  const download = await f.request(links.download_url);
  expect(new Uint8Array(await download.arrayBuffer())).toEqual(png);
});

it("rejects preview-to-original promotion, missing sources and image-embedded original downloads before cache", async () => {
  const f = fixture();
  const links = await assetDeliverySigner("https://assets.example.test", secret)(key);
  await f.request(links.url);
  await Promise.all(f.work);
  const lookups = f.cache.match.mock.calls.length;
  const changed = new URL(links.url);
  changed.searchParams.set("variant", "download");
  expect((await f.request(changed.href)).status).toBe(403);
  changed.pathname = changed.pathname.replace(/\.preview\.webp$/, ".png");
  expect((await f.request(changed.href)).status).toBe(403);
  expect((await f.request(links.url, {})).status).toBe(403);
  expect(
    (await f.request(links.download_url, { Origin: origin, "Sec-Fetch-Dest": "image" })).status,
  ).toBe(403);
  expect(f.cache.match).toHaveBeenCalledTimes(lookups);
});
