import { createHash, randomUUID } from "node:crypto";
import type { ImagesBinding, R2Bucket } from "@cloudflare/workers-types";
import { cloudflareImages } from "./cloudflare-images";
import {
  type ImageOutputSize,
  type ImageStore,
  ImageValidationError,
  objectKeySchema,
  type StorageUid,
  userObjectKey,
} from "./core";
import { displayObjectKey, providerReferenceObjectKey } from "./image-variants";
import type { ImageObjectBucket } from "./object-bucket";

export function r2ObjectBucket(
  bucket: Pick<R2Bucket, "head" | "get" | "put" | "delete">,
): ImageObjectBucket {
  return {
    head: (key) => bucket.head(objectKeySchema.parse(key)),
    get: (key) => bucket.get(objectKeySchema.parse(key)),
    put: (key, bytes, options) => bucket.put(objectKeySchema.parse(key), bytes, options),
    delete: (key) => bucket.delete(key),
  };
}

async function normalizeOutput(
  codec: ReturnType<typeof cloudflareImages>,
  input: Uint8Array,
  outputSize?: ImageOutputSize,
) {
  const source = await codec.info(input);
  if (!outputSize) return codec.encode(input);
  if (source.width < outputSize.width - 15 || source.height < outputSize.height - 15)
    throw new ImageValidationError("OUTPUT_RESOLUTION_TOO_SMALL");
  if (source.width < outputSize.width || source.height < outputSize.height)
    return codec.encode(input);
  return codec.encode(
    input,
    outputSize.width,
    outputSize.height,
    "image/png",
    undefined,
    "contain",
  );
}

export function cloudflareImageStore(
  bucket: ImageObjectBucket,
  images: Pick<ImagesBinding, "info" | "input">,
  resolveUid: StorageUid,
): ImageStore {
  const codec = cloudflareImages(images);
  const preparedReferences = new WeakSet<Uint8Array>();
  const read = async (key: string) => {
    const object = await bucket.get(objectKeySchema.parse(key));
    if (!object || object.size > 32 * 1024 * 1024) throw new Error("IMAGE_STORAGE_UNAVAILABLE");
    return new Uint8Array(await object.arrayBuffer());
  };
  return {
    async ready() {
      await bucket.head("health/storage-probe");
    },
    async prepareReferenceUpload(bytes) {
      const prepared = await codec.reference(bytes);
      preparedReferences.add(prepared);
      return prepared;
    },
    // Keep transparency and original pixels for references; JPEG optimization can be measured later.
    async prepareProviderReference(bytes) {
      return bytes;
    },
    async put(scope, input, id = randomUUID(), outputSize) {
      const key = userObjectKey(await resolveUid(scope), scope.organizationId, id);
      // Preserve a received paid result even if Images or a subsequent R2 write fails.
      await bucket.put(`${key}.source`, input, {
        httpMetadata: { contentType: "application/octet-stream" },
      });
      const data = preparedReferences.has(input)
        ? input
        : await normalizeOutput(codec, input, outputSize);
      const metadata = await codec.info(data);
      if (metadata.width > 8192 || metadata.height > 8192)
        throw new ImageValidationError("INVALID_IMAGE");
      await bucket.put(key, data, { httpMetadata: { contentType: "image/png" } });
      for (const variant of ["thumbnail", "preview"] as const) {
        await bucket.put(displayObjectKey(key, variant), await codec.variant(data, variant), {
          httpMetadata: { contentType: "image/webp" },
        });
      }
      await bucket.delete(`${key}.source`);
      return {
        id,
        objectKey: key,
        mimeType: "image/png",
        bytes: data.length,
        width: metadata.width,
        height: metadata.height,
        sha256: createHash("sha256").update(data).digest("hex"),
      };
    },
    read: (asset) => read(asset.objectKey),
    async thumbnail(asset) {
      return codec.encode(await read(asset.objectKey), 512, 512);
    },
    async remove(asset) {
      objectKeySchema.parse(asset.objectKey);
      await bucket.delete([
        asset.objectKey,
        `${asset.objectKey}.source`,
        displayObjectKey(asset.objectKey, "thumbnail"),
        displayObjectKey(asset.objectKey, "preview"),
        providerReferenceObjectKey(asset.objectKey, "jpg"),
        providerReferenceObjectKey(asset.objectKey, "png"),
      ]);
    },
  };
}
export { cloudflareImages };
