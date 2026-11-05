import { createHash, randomUUID } from "node:crypto";
import type { ImageScope, StoredImage } from "@lycoboai/contracts";
import { imageLimits } from "@lycoboai/contracts";
import sharp from "sharp";
import { type ImageStore, objectKeySchema, type StorageUid, userObjectKey } from "./core";
import { normalizeImage } from "./image-store";
import { displayObjectKey, providerReferenceObjectKey } from "./image-variants";
import type { ImageObjectBucket } from "./object-bucket";

/** Node image processing for private cloud storage. */
export function objectImageStore(bucket: ImageObjectBucket, resolveUid?: StorageUid): ImageStore {
  const thumbnailKey = (key: string) => key.replace(/\.png$/, ".thumbnail.png");
  const read = async (key: string) => {
    objectKeySchema.parse(key);
    const object = await bucket.get(key);
    if (!object || object.size > imageLimits.outputBytes)
      throw new Error("IMAGE_STORAGE_UNAVAILABLE");
    return new Uint8Array(await object.arrayBuffer());
  };
  return {
    async ready() {
      // Credentials are validated when the bucket adapter is constructed.
    },
    async put(scope: ImageScope, input, id = randomUUID(), outputSize) {
      if (!resolveUid) throw new Error("STORAGE_IDENTITY_NOT_CONFIGURED");
      const image = await normalizeImage(input, outputSize);
      const key = userObjectKey(await resolveUid(scope), scope.organizationId, id);
      const sha256 = createHash("sha256").update(image.data).digest("hex");
      await bucket.put(key, image.data, { httpMetadata: { contentType: "image/png" } });
      // Save the paid original first; failed variants must never cause provider resubmission.
      // Pages only show the WebP variants. The PNG thumbnail (about 16 times the WebP size)
      // serves the variation planner alone, so thumbnail() creates it on first use.
      for (const variant of ["thumbnail", "preview"] as const) {
        const size = variant === "thumbnail" ? 512 : 1600;
        const bytes = await sharp(image.data)
          .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
          .webp({ quality: variant === "thumbnail" ? 76 : 82 })
          .toBuffer();
        await bucket.put(displayObjectKey(key, variant), bytes, {
          httpMetadata: { contentType: "image/webp" },
        });
      }
      return {
        id,
        objectKey: key,
        mimeType: "image/png",
        bytes: image.data.length,
        width: image.width,
        height: image.height,
        sha256,
      };
    },
    read: (asset: StoredImage) => read(asset.objectKey),
    async thumbnail(asset) {
      objectKeySchema.parse(asset.objectKey);
      const cached = await bucket.get(thumbnailKey(asset.objectKey));
      if (cached) return new Uint8Array(await cached.arrayBuffer());
      const bytes = await sharp(await read(asset.objectKey))
        .resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();
      await bucket.put(thumbnailKey(asset.objectKey), bytes, {
        httpMetadata: { contentType: "image/png" },
      });
      return bytes;
    },
    async remove(asset) {
      objectKeySchema.parse(asset.objectKey);
      await bucket.delete([
        asset.objectKey,
        thumbnailKey(asset.objectKey),
        displayObjectKey(asset.objectKey, "preview"),
        displayObjectKey(asset.objectKey, "thumbnail"),
        providerReferenceObjectKey(asset.objectKey, "jpg"),
        providerReferenceObjectKey(asset.objectKey, "png"),
      ]);
    },
  };
}
