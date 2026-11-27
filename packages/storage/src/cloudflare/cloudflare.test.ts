import type { ImagesBinding } from "@cloudflare/workers-types";
import sharp from "sharp";
import { expect, it, vi } from "vitest";
import type { ImageObjectBucket } from "../buckets/object-bucket";
import { cloudflareImageStore, cloudflareImages } from "./cloudflare";

function imagesFixture() {
  const info = vi.fn(async (stream: ReadableStream<Uint8Array>) => {
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    const metadata = await sharp(bytes).metadata();
    return {
      format: `image/${metadata.format}`,
      width: metadata.width,
      height: metadata.height,
      fileSize: bytes.length,
    };
  });
  const output = vi.fn();
  const input = (stream: ReadableStream<Uint8Array>) => {
    let resize: { width: number; height: number } | undefined;
    const transformer = {
      transform(options: { width: number; height: number }) {
        resize = options;
        return transformer;
      },
      async output(options: { format: string; quality?: number }) {
        output(options);
        const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
        let pipeline = sharp(bytes).rotate();
        if (resize)
          pipeline = pipeline.resize({ ...resize, fit: "inside", withoutEnlargement: true });
        const result =
          options.format === "image/webp"
            ? await pipeline.webp({ quality: options.quality }).toBuffer()
            : await pipeline.png().toBuffer();
        return { response: () => new Response(result) };
      },
    };
    return transformer;
  };
  return {
    binding: { info, input } as unknown as Pick<ImagesBinding, "info" | "input">,
    info,
    output,
  };
}
it("persists a transparent PNG and bounded WebP variants without lossy PNG quality options", async () => {
  const f = imagesFixture();
  const objects = new Map<string, Uint8Array>();
  const bucket = {
    put: vi.fn(async (key: string, bytes: Uint8Array) => {
      objects.set(key, bytes);
    }),
    delete: vi.fn(async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key);
    }),
  } as unknown as ImageObjectBucket;
  const store = cloudflareImageStore(bucket, f.binding, async () => "1234567890");
  const bytes = await sharp({
    create: { width: 1800, height: 900, channels: 4, background: "transparent" },
  })
    .png()
    .toBuffer();
  const prepared = await store.prepareReferenceUpload!(bytes);
  const encodedBefore = f.output.mock.calls.length;
  const asset = await store.put(
    { userId: crypto.randomUUID(), organizationId: crypto.randomUUID() },
    prepared,
  );
  expect(f.output.mock.calls.length - encodedBefore).toBe(2);
  const original = objects.get(asset.objectKey)!;
  expect(await sharp(original).metadata()).toMatchObject({ width: 1800, hasAlpha: true });
  expect(
    await sharp(objects.get(asset.objectKey.replace(".png", ".thumbnail.webp"))!).metadata(),
  ).toMatchObject({ width: 512, format: "webp" });
  expect(
    f.output.mock.calls
      .filter(([options]) => options.format === "image/png")
      .every(([options]) => options.quality === undefined),
  ).toBe(true);
});
it("rejects oversized and animated input before invoking Images", async () => {
  const f = imagesFixture();
  const codec = cloudflareImages(f.binding);
  await expect(codec.info(new Uint8Array(21 * 1024 * 1024))).rejects.toThrow("INVALID_IMAGE");
  const animated = new Uint8Array([0x89, 0x50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 97, 99, 84, 76]);
  await expect(codec.info(animated)).rejects.toThrow("INVALID_IMAGE");
  expect(f.info).not.toHaveBeenCalled();
});
it("stores automated references byte-for-byte as one private WebP object", async () => {
  const f = imagesFixture();
  const put = vi.fn<ImageObjectBucket["put"]>(async () => undefined);
  const bucket: ImageObjectBucket = {
    put,
    get: async () => null,
    head: async () => null,
    delete: async () => undefined,
  };
  const store = cloudflareImageStore(bucket, f.binding, async () => "1234567890");
  const scope = { organizationId: crypto.randomUUID(), userId: crypto.randomUUID() };
  const image = sharp({
    create: { width: 1601, height: 900, channels: 4, background: "transparent" },
  });
  await expect(
    store.putAutomationReference?.(scope, await image.clone().webp().toBuffer()),
  ).rejects.toThrow("INVALID_IMAGE");
  await expect(
    store.putAutomationReference?.(scope, await image.clone().png().toBuffer()),
  ).rejects.toThrow("INVALID_IMAGE");
  const webp = await image.resize(1600).webp().toBuffer();
  const asset = await store.putAutomationReference?.(scope, webp);
  expect(asset).toMatchObject({
    objectKey: expect.stringMatching(/\.webp$/),
    width: 1600,
    mimeType: "image/webp",
  });
  expect(put).toHaveBeenCalledExactlyOnceWith(asset?.objectKey, webp, {
    httpMetadata: { contentType: "image/webp" },
  });
  expect(f.output).not.toHaveBeenCalled();
});
it.each([undefined, { width: 705, height: 1254 }])(
  "delivers the original provider PNG when Images transformations are unavailable (%j)",
  async (outputSize) => {
    const f = imagesFixture();
    const output = vi.fn(() => {
      throw new Error("IMAGE_TRANSFORM_UNAVAILABLE");
    });
    const put = vi.fn<ImageObjectBucket["put"]>(async () => undefined);
    const remove = vi.fn(async () => {});
    const bucket: ImageObjectBucket = {
      put,
      delete: remove,
      head: async () => null,
      get: async () => null,
    };
    const binding = { ...f.binding, input: output };
    const store = cloudflareImageStore(bucket, binding, async () => "1234567890");
    const scope = { userId: crypto.randomUUID(), organizationId: crypto.randomUUID() };
    const bytes = await sharp({
      create: { width: 705, height: 1254, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    const asset = await store.put(scope, bytes, undefined, outputSize);
    expect(asset).toMatchObject({ width: 705, height: 1254, bytes: bytes.length });
    expect(put).toHaveBeenCalledWith(asset.objectKey, bytes, expect.anything());
    expect(remove).toHaveBeenCalledWith(`${asset.objectKey}.source`);
    expect(f.info).toHaveBeenCalledTimes(1);
    expect(output).toHaveBeenCalledTimes(2);
  },
);
