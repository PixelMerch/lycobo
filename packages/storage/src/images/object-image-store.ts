import { createHash, randomUUID } from "node:crypto";
import type { ImageScope, StoredImage } from "@lycoboai/contracts";
import { imageLimits } from "@lycoboai/contracts";
import sharp from "sharp";
import type { ImageObjectBucket } from "../buckets/object-bucket";
import { normalizeImage, normalizeReferenceUpload, providerReference } from "../local/image-store";
import {
  type ImageStorageTiming,
  type ImageStore,
  objectKeySchema,
  type StorageUid,
  userObjectKey,
} from "./core";
import {
  displayObjectKey,
  displayVariants,
  providerReferenceObjectKey,
  readStoredDisplayThumbnail,
} from "./image-variants";

function reportStorageTiming(
  onTiming: ((event: ImageStorageTiming) => void) | undefined,
  stage: ImageStorageTiming["stage"],
  started: number,
) {
  try {
    onTiming?.({ stage, durationMs: Math.round(performance.now() - started) });
  } catch {
    // Telemetry cannot change the outcome of an image write.
  }
}

async function encodeDisplayVariants(original: Uint8Array, key: string) {
  const variants = [];
  for (const variant of ["thumbnail", "preview"] as const) {
    const { width, height, quality } = displayVariants[variant];
    const bytes = await sharp(original)
      .resize({ width, height, fit: "inside", withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
    variants.push({ key: displayObjectKey(key, variant), bytes });
  }
  return variants;
}

/** 本地 Node 进程通过私有对象存储保存原图和展示变体。 */
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
    prepareReferenceUpload: normalizeReferenceUpload,
    prepareProviderReference: providerReference,
    async ready() {
      // 创建存储适配器时已验证凭据配置。
    },
    async put(scope: ImageScope, input, id = randomUUID(), outputSize, onTiming) {
      if (!resolveUid) throw new Error("STORAGE_IDENTITY_NOT_CONFIGURED");
      const encodeStarted = performance.now();
      const image = await normalizeImage(input, outputSize);
      reportStorageTiming(onTiming, "image_encode", encodeStarted);
      const key = userObjectKey(await resolveUid(scope), scope.organizationId, id);
      const sha256 = createHash("sha256").update(image.data).digest("hex");
      const originalStarted = performance.now();
      await bucket.put(key, image.data, { httpMetadata: { contentType: "image/png" } });
      reportStorageTiming(onTiming, "image_original_put", originalStarted);
      // 先保存付费原图，变体失败时不得重新提交供应商任务。
      // 页面和 Agent 使用 WebP。套图规划专用的 PNG 缩略图由 thumbnail() 按需生成。
      const variantEncodeStarted = performance.now();
      const variants = await encodeDisplayVariants(image.data, key);
      reportStorageTiming(onTiming, "image_variant_encode", variantEncodeStarted);
      const variantPutStarted = performance.now();
      const uploads = await Promise.allSettled(
        variants.map(({ key: variantKey, bytes }) =>
          bucket.put(variantKey, bytes, { httpMetadata: { contentType: "image/webp" } }),
        ),
      );
      reportStorageTiming(onTiming, "image_variant_put", variantPutStarted);
      const failedUpload = uploads.find((upload) => upload.status === "rejected");
      if (failedUpload) throw failedUpload.reason;
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
    readDisplayThumbnail: (objectKey) => readStoredDisplayThumbnail(bucket, objectKey),
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
