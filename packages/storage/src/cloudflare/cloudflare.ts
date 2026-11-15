import { createHash, randomUUID } from "node:crypto";
import type { ImagesBinding, R2Bucket } from "@cloudflare/workers-types";
import type { ImageObjectBucket } from "../buckets/object-bucket";
import {
  type ImageOutputSize,
  type ImageStore,
  ImageValidationError,
  objectKeySchema,
  type StorageUid,
  userObjectKey,
} from "../images/core";
import { displayObjectKey, providerReferenceObjectKey } from "../images/image-variants";
import { persistImageOutput, preserveAndNormalize, timeImageWrite } from "./cloudflare-image-write";
import { cloudflareImages } from "./cloudflare-images";

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
  const isCompletePng =
    (source.format === "image/png" || source.format === "png") && hasPngEnd(input);
  if (!outputSize) return isCompletePng ? input : codec.encode(input);
  if (source.width < outputSize.width - 15 || source.height < outputSize.height - 15)
    throw new ImageValidationError("OUTPUT_RESOLUTION_TOO_SMALL");
  // 已符合交付尺寸的 PNG 不需要调用付费转码；检查完整 IEND，避免交付截断的响应。
  const withinTolerance =
    source.width <= outputSize.width + 15 && source.height <= outputSize.height + 15;
  if (withinTolerance && isCompletePng) return input;
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

function hasPngEnd(input: Uint8Array) {
  // PNG 的 IEND 块长度为 0，类型和 CRC 固定。
  const end = [0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130];
  return end.every((byte, index) => input[input.length - end.length + index] === byte);
}

/** 持久化原图并生成展示变体，原图处理失败时保留供应商源图。 */
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
      await timeImageWrite(
        "image_source_delete",
        () => bucket.delete(`${key}.source`),
        onTiming,
      ).catch(() => {
        // 原图已持久化，暂存副本清理异常不能撤销交付。
        console.warn("IMAGE_SOURCE_CLEANUP_FAILED", id);
      });
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
