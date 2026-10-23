import { assetDeliverySigner } from "@lycoboai/storage/delivery";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { type AssetBindings, serveAsset } from "./index";

const secret = "fixture-only-asset-signing-secret-0001";
const origin = "https://lycobo.pages.dev";
const key = `0057849613/${crypto.randomUUID()}/${crypto.randomUUID()}.png`;
const mf = new Miniflare(
  convertV4MiniflareOptions({
    modules: true,
    script: "export default { fetch() { return new Response('fixture'); } }",
    r2Buckets: { BUCKET: "asset-fixture" },
  }),
);
let bucket: R2Bucket;
beforeAll(async () => {
  bucket = (await mf.getBindings<{ BUCKET: R2Bucket }>()).BUCKET;
  await bucket.put(key, "original fixture");
  await bucket.put(key.replace(/\.png$/, ".thumbnail.png"), "thumbnail fixture");
});
afterAll(() => mf.dispose());
function fixture() {
  const get = vi.fn(bucket.get.bind(bucket));
  const head = vi.fn(bucket.head.bind(bucket));
  const env: AssetBindings = {
    IMAGES_BUCKET: { ...bucket, get, head },
    ASSET_SIGNING_SECRET: secret,
    ASSET_ALLOWED_ORIGINS: origin,
  };
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
    headers: HeadersInit = { Referer: `${origin}/create`, Origin: origin },
    method = "GET",
  ) => serveAsset(new Request(url, { headers, method }), env, ctx, cache);
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
    expect(await first.text()).toBe("original fixture");
    await Promise.all(f.work);
    const second = await f.request(links.download_url, {});
    expect(second.headers.get("X-Asset-Cache")).toBe("HIT");
    expect(second.headers.get("Content-Disposition")).toContain("attachment");
    expect(await second.text()).toBe("original fixture");
    expect(f.get).toHaveBeenCalledTimes(1);
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
    const head = await f.request(links.url, {}, "HEAD");
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
