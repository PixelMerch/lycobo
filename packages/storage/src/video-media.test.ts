import { expect, it } from "vitest";
import { assetDeliverySigner, providerReferenceSigner } from "./asset-delivery";
import type { ImageObjectBucket } from "./object-bucket";
import { servePrivateAsset } from "./private-asset-server";
import { videoDimensions } from "./video-media";

const key =
  "0057849613/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002.mp4";
const secret = "video-capability-test-secret-00000000000";
const options = (bytes: Uint8Array) => ({
  signingSecret: secret,
  allowedOrigins: "https://app.test",
  bucket: {
    get: async () => ({
      size: bytes.length,
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      }),
      arrayBuffer: async () => new Uint8Array(bytes).buffer,
    }),
    head: async () => ({ size: bytes.length, httpEtag: "fixture" }),
    put: async () => {},
    delete: async () => {},
  } satisfies ImageObjectBucket,
});
it("video delivery validates the signed capability and returns byte ranges without image conversion", async () => {
  const links = await assetDeliverySigner("https://assets.test", secret)(key);
  const response = await servePrivateAsset(
    new Request(links.url, { headers: { Referer: "https://app.test/", Range: "bytes=1-3" } }),
    options(new Uint8Array([1, 2, 3, 4, 5])),
  );
  expect(response.status).toBe(206);
  expect(response.headers.get("Content-Type")).toBe("video/mp4");
  expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([2, 3, 4]);
  expect(
    (await servePrivateAsset(new Request(links.url), options(new Uint8Array([1])))).status,
  ).toBe(403);
  expect(
    (
      await servePrivateAsset(
        new Request(links.url.replace("sig=", "sig=invalid"), {
          headers: { Referer: "https://app.test/" },
        }),
        options(new Uint8Array([1])),
      )
    ).status,
  ).toBe(403);
});
it("provider references use a separate capability and need no browser origin", async () => {
  const link = await providerReferenceSigner(
    "https://assets.test",
    secret,
  )(key.replace(/\.mp4$/, ".png"));
  const response = await servePrivateAsset(new Request(link), options(new Uint8Array([1, 2])));
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("image/png");
  const normal = await assetDeliverySigner(
    "https://assets.test",
    secret,
  )(key.replace(/\.mp4$/, ".png"));
  expect(
    (await servePrivateAsset(new Request(normal.url), options(new Uint8Array([1, 2])))).status,
  ).toBe(403);
});
it("non-video and malformed BMFF bodies cannot enter the private video store", () => {
  expect(() => videoDimensions(new TextEncoder().encode("not a video"))).toThrow("INVALID_VIDEO");
  const truncated = new Uint8Array([0, 0, 0, 64, 102, 116, 121, 112]);
  expect(() => videoDimensions(truncated)).toThrow("INVALID_VIDEO");
});

it("separates video cover, preview and original bytes and never falls back to original on preview failure", async () => {
  const links = await assetDeliverySigner("https://assets.test", secret)(key);
  expect(new URL(links.url).pathname).toBe(`/${key}.preview.mp4`);
  expect(new URL(links.thumbnail_url).pathname).toBe(`/${key}.thumbnail.webp`);
  expect(new URL(links.download_url).pathname).toBe(`/${key}`);
  const reads: string[] = [];
  const objects = new Map<string, Uint8Array>([[key, new Uint8Array([1, 2, 3])]]);
  const base: Parameters<typeof servePrivateAsset>[1] = options(new Uint8Array([1]));
  base.bucket.get = async (id) => {
    reads.push(id);
    const bytes = objects.get(id);
    return bytes
      ? {
          size: bytes.length,
          arrayBuffer: async () => new Uint8Array(bytes).buffer,
          body: new ReadableStream<Uint8Array>({
            start(c) {
              c.enqueue(bytes);
              c.close();
            },
          }),
        }
      : null;
  };
  const headers = { Referer: "https://app.test/" };
  expect((await servePrivateAsset(new Request(links.url, { headers }), base)).status).toBe(404);
  expect(reads).not.toContain(key);
  const createVideoVariant = async (id: string, variant: "preview" | "thumbnail") => {
    objects.set(
      `${id}.${variant}.${variant === "thumbnail" ? "webp" : "mp4"}`,
      new Uint8Array([7, 8, 9]),
    );
  };
  const cover = await servePrivateAsset(new Request(links.thumbnail_url, { headers }), {
    ...base,
    createVideoVariant,
  });
  expect(cover.headers.get("Content-Type")).toBe("image/webp");
  expect([...new Uint8Array(await cover.arrayBuffer())]).toEqual([7, 8, 9]);
  const preview = await servePrivateAsset(
    new Request(links.url, { headers: { ...headers, Range: "bytes=0-1" } }),
    { ...base, createVideoVariant },
  );
  expect(preview.status).toBe(206);
  expect([...new Uint8Array(await preview.arrayBuffer())]).toEqual([7, 8]);
  const original = await servePrivateAsset(new Request(links.download_url, { headers }), base);
  expect([...new Uint8Array(await original.arrayBuffer())]).toEqual([1, 2, 3]);
  expect(original.headers.get("Content-Disposition")).toContain("attachment");
  reads.length = 0;
  expect(
    (await servePrivateAsset(new Request(links.thumbnail_url), { ...base, createVideoVariant }))
      .status,
  ).toBe(403);
  expect(reads).toEqual([]);
});
