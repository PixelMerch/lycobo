import sharp from "sharp";
import { expect, it, vi } from "vitest";
import { assetSigningKey, signAsset } from "../delivery/asset-delivery";
import { servePrivateAsset } from "../delivery/private-asset-server";
import { displayObjectKey } from "../images/image-variants";
import { objectImageStore } from "../images/object-image-store";
import { imageObjectBucket } from "./s3-object-bucket";

const config = {
  S3_ENDPOINT: "http://127.0.0.1:9004",
  S3_BUCKET: "generated-images",
  S3_REGION: "us-east-1",
  S3_ACCESS_KEY_ID: "local-image-dev",
  S3_SECRET_ACCESS_KEY: "local-image-dev-only",
};
it("fails closed when storage is absent or S3 rejects a write", async () => {
  expect(() => imageObjectBucket({})).toThrow("IMAGE_STORAGE_NOT_CONFIGURED");
  const request = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(null, { status: 403 }));
  try {
    await expect(imageObjectBucket(config).put("fixture.png", new Uint8Array([1]))).rejects.toThrow(
      "IMAGE_STORAGE_UNAVAILABLE",
    );
    expect(request).toHaveBeenCalledTimes(1);
  } finally {
    request.mockRestore();
  }
});
it.skipIf(process.env.ALLOW_LOCAL_S3_INTEGRATION !== "true")(
  "stores originals and display variants in private S3 and serves them only with valid signed access",
  async () => {
    const bucket = imageObjectBucket(config);
    const store = objectImageStore(bucket, async () => "0057849613");
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
      const options = { bucket, signingSecret: secret, allowedOrigins: "http://localhost:8081" };
      const url = `http://cdn.lycobo.localhost/${asset.objectKey}?expires=${expires}&variant=download&sig=${sig}`;
      const result = await servePrivateAsset(
        new Request(url, { headers: { Origin: "http://localhost:8081" } }),
        options,
      );
      expect(result.status).toBe(200);
      expect((await result.arrayBuffer()).byteLength).toBe(asset.bytes);
      expect(
        (
          await servePrivateAsset(
            new Request(url.replace(sig, "invalid"), {
              headers: { Origin: "http://localhost:8081" },
            }),
            options,
          )
        ).status,
      ).toBe(403);
    } finally {
      await store.remove(asset);
    }
    expect(await bucket.head(asset.objectKey)).toBeNull();
  },
  30000,
);

it("uses manual redirects and refuses S3 redirects without forwarding credentials", async () => {
  const request = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      new Response(null, { status: 302, headers: { Location: "https://untrusted.example.com/" } }),
    );
  try {
    await expect(imageObjectBucket(config).get("fixture.png")).rejects.toThrow(
      "IMAGE_STORAGE_UNAVAILABLE",
    );
    expect(request).toHaveBeenCalledTimes(1);
    const call = request.mock.calls[0];
    expect(call && new Request(call[0], call[1]).redirect).toBe("manual");
  } finally {
    request.mockRestore();
  }
});

it("signs virtual-host requests with the configured region and session token", async () => {
  const request = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(null, { status: 200 }));
  try {
    await imageObjectBucket({
      ...config,
      S3_ENDPOINT: "https://cos.ap-guangzhou.myqcloud.com",
      S3_BUCKET: "private-1250000000",
      S3_REGION: "ap-guangzhou",
      S3_FORCE_PATH_STYLE: "false",
      S3_SESSION_TOKEN: "fixture-token",
    }).put("folder/image.png", new Uint8Array([1]), { httpMetadata: { contentType: "image/png" } });
    const call = request.mock.calls[0];
    if (!call) throw new Error("REQUEST_REQUIRED");
    const signed = new Request(call[0], call[1]);
    expect(signed.url).toBe(
      "https://private-1250000000.cos.ap-guangzhou.myqcloud.com/folder/image.png",
    );
    expect(signed.headers.get("authorization")).toContain("/ap-guangzhou/s3/aws4_request");
    expect(signed.headers.get("x-amz-security-token")).toBe("fixture-token");
  } finally {
    request.mockRestore();
  }
});

it("returns missing S3 objects without consulting another storage provider", async () => {
  const request = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(null, { status: 404 }));
  try {
    const store = imageObjectBucket(config);
    expect(await store.head("missing.png")).toBeNull();
    expect(await store.get("missing.png")).toBeNull();
    await expect(store.delete("missing.png")).resolves.toBeUndefined();
    expect(() => imageObjectBucket({})).toThrow("IMAGE_STORAGE_NOT_CONFIGURED");
    expect(() => imageObjectBucket({ S3_BUCKET: "partial" })).toThrow("INVALID_S3_CONFIGURATION");
  } finally {
    request.mockRestore();
  }
});
