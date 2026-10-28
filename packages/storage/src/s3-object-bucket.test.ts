import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import sharp from "sharp";
import { expect, it, vi } from "vitest";
import { serveAsset } from "../../../apps/assets/src/index";
import { assetSigningKey, signAsset } from "./asset-delivery";
import { displayObjectKey } from "./image-variants";
import type { ImageObjectBucket } from "./object-bucket";
import { r2ImageStore } from "./r2-image-store";
import { imageObjectBucket } from "./s3-object-bucket";

const config = {
  S3_ENDPOINT: "http://127.0.0.1:9004",
  S3_BUCKET: "generated-images",
  S3_REGION: "us-east-1",
  S3_ACCESS_KEY_ID: "local-image-dev",
  S3_SECRET_ACCESS_KEY: "local-image-dev-only",
};
it("does not silently save to R2 when S3 writes fail", async () => {
  const put = vi.fn();
  const fallback: ImageObjectBucket = {
    head: async () => null,
    get: async () => null,
    put,
    delete: async () => {},
  };
  expect(imageObjectBucket({}, fallback)).toBe(fallback);
  const request = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(null, { status: 403 }));
  try {
    await expect(
      imageObjectBucket(config, fallback).put("fixture.png", new Uint8Array([1])),
    ).rejects.toThrow("IMAGE_STORAGE_UNAVAILABLE");
    expect(put).not.toHaveBeenCalled();
  } finally {
    request.mockRestore();
  }
});
it.skipIf(process.env.ALLOW_LOCAL_S3_INTEGRATION !== "true")(
  "stores originals and display variants in private S3 and serves them only with valid signed access",
  async () => {
    const mf = new Miniflare(
      convertV4MiniflareOptions({
        modules: true,
        script: "export default { fetch() { return new Response('fixture'); } }",
        r2Buckets: { BUCKET: "s3-fallback-fixture" },
        images: { binding: "IMAGES" },
      }),
    );
    try {
      const { BUCKET, IMAGES } = await mf.getBindings<{
        BUCKET: R2Bucket;
        IMAGES: ImagesBinding;
      }>();
      const bucket = imageObjectBucket(config, BUCKET);
      const store = r2ImageStore(bucket, IMAGES, async () => "0057849613");
      const source = await sharp({
        create: { width: 800, height: 600, channels: 3, background: "blue" },
      })
        .png()
        .toBuffer();
      const asset = await store.put(
        { userId: crypto.randomUUID(), organizationId: crypto.randomUUID() },
        source,
      );
      try {
        expect((await BUCKET.list()).objects).toHaveLength(0);
        expect((await sharp(Buffer.from(await store.read(asset))).metadata()).width).toBe(800);
        for (const variant of ["preview", "thumbnail"] as const)
          expect(await bucket.head(displayObjectKey(asset.objectKey, variant))).not.toBeNull();
        expect(
          (await fetch(`${config.S3_ENDPOINT}/${config.S3_BUCKET}/${asset.objectKey}`)).status,
        ).toBe(403);
        const secret = "fixture-asset-signing-secret-32-characters";
        const expires = Math.floor(Date.now() / 1000) + 60;
        const sig = await signAsset(
          asset.objectKey,
          expires,
          await assetSigningKey(secret),
          "download",
        );
        const env = {
          ...config,
          IMAGES_BUCKET: BUCKET,
          ASSET_SIGNING_SECRET: secret,
          ASSET_ALLOWED_ORIGINS: "http://localhost:8081",
        };
        const context = { waitUntil: (_promise: Promise<unknown>) => {} };
        const cache = { match: async () => undefined, put: async () => {} };
        const url = `http://cdn.lycobo.localhost/${asset.objectKey}?expires=${expires}&variant=download&sig=${sig}`;
        const result = await serveAsset(
          new Request(url, { headers: { Origin: "http://localhost:8081" } }),
          env,
          context,
          cache,
        );
        expect(result.status).toBe(200);
        expect((await result.arrayBuffer()).byteLength).toBe(asset.bytes);
        expect(
          (
            await serveAsset(
              new Request(url.replace(sig, "invalid"), {
                headers: { Origin: "http://localhost:8081" },
              }),
              env,
              context,
              cache,
            )
          ).status,
        ).toBe(403);
        const legacyKey = asset.objectKey.replace(/\.png$/, ".legacy.png");
        await BUCKET.put(legacyKey, source);
        expect((await bucket.get(legacyKey))?.size).toBe(source.length);
        await bucket.delete(legacyKey);
      } finally {
        await store.remove(asset);
      }
      expect(await bucket.head(asset.objectKey)).toBeNull();
    } finally {
      await mf.dispose();
    }
  },
  30000,
);

it("uses Workers-compatible manual redirects and refuses S3 redirects without forwarding credentials", async () => {
  const fallback = { head: vi.fn(), get: vi.fn(), put: vi.fn(), delete: vi.fn() };
  const request = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      new Response(null, { status: 302, headers: { Location: "https://untrusted.example.com/" } }),
    );
  try {
    await expect(imageObjectBucket(config, fallback).get("fixture.png")).rejects.toThrow(
      "IMAGE_STORAGE_UNAVAILABLE",
    );
    expect(request).toHaveBeenCalledTimes(1);
    const call = request.mock.calls[0];
    expect(call && new Request(call[0], call[1]).redirect).toBe("manual");
    expect(fallback.get).not.toHaveBeenCalled();
  } finally {
    request.mockRestore();
  }
});
