import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import sharp from "sharp";
import { expect, it } from "vitest";
import { displayObjectKey } from "./image-variants";
import { r2ImageStore } from "./r2-image-store";

it("precomputes bounded WebP variants without resizing the stored original and removes all versions", async () => {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: "export default { fetch() { return new Response('fixture'); } }",
      r2Buckets: { BUCKET: "variants-fixture" },
      images: { binding: "IMAGES" },
    }),
  );
  try {
    const { BUCKET, IMAGES } = await mf.getBindings<{ BUCKET: R2Bucket; IMAGES: ImagesBinding }>();
    const source = await sharp({
      create: { width: 2400, height: 1800, channels: 3, background: "#789abc" },
    })
      .png()
      .toBuffer();
    const store = r2ImageStore(BUCKET, IMAGES, async () => "0057849613");
    const asset = await store.put(
      { userId: crypto.randomUUID(), organizationId: crypto.randomUUID() },
      source,
    );
    expect([asset.width, asset.height]).toEqual([2400, 1800]);
    for (const [variant, width, height] of [
      ["thumbnail", 512, 384],
      ["preview", 1600, 1200],
    ] as const) {
      const object = await BUCKET.get(displayObjectKey(asset.objectKey, variant));
      if (!object) throw new Error("Missing display variant");
      const meta = await sharp(Buffer.from(await object.arrayBuffer())).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual(["webp", width, height]);
    }
    const original = await sharp(Buffer.from(await store.read(asset))).metadata();
    expect([original.format, original.width, original.height]).toEqual(["png", 2400, 1800]);
    await store.remove(asset);
    expect((await BUCKET.list()).objects).toHaveLength(0);
  } finally {
    await mf.dispose();
  }
});
