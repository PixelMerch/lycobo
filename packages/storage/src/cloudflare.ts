import { createHash, randomUUID } from "node:crypto";
import type { ImagesBinding, R2Bucket } from "@cloudflare/workers-types";
import { persistImageOutput, preserveAndNormalize, timeImageWrite } from "./cloudflare-image-write";
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

/** 将已有 R2 绑定适配为私有图片存储操作。 */
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

/** 保存规范化图片及完整展示变体，失败时保留供应商源图。 */
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
    // 参考图保留透明通道与原始像素。
    async prepareProviderReference(bytes) {
      return bytes;
    },
    async put(scope, input, id = randomUUID(), outputSize, onTiming) {
      const key = userObjectKey(await resolveUid(scope), scope.organizationId, id);
      const data = await preserveAndNormalize(
        bucket,
        key,
        input,
        () =>
          preparedReferences.has(input)
            ? Promise.resolve(input)
            : normalizeOutput(codec, input, outputSize),
        onTiming,
      );
      const metadata = await timeImageWrite("image_metadata", () => codec.info(data), onTiming);
      if (metadata.width > 8192 || metadata.height > 8192)
        throw new ImageValidationError("INVALID_IMAGE");
      await persistImageOutput(bucket, codec, key, data, onTiming);
      await timeImageWrite("image_source_delete", () => bucket.delete(`${key}.source`), onTiming);
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
