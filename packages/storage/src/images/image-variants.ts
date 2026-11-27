import type { ImageObjectBucket } from "../buckets/object-bucket";

export const displayVariants = {
  thumbnail: { width: 512, height: 512, quality: 76 },
  preview: { width: 1600, height: 1600, quality: 82 },
} as const;
export type DisplayVariant = keyof typeof displayVariants;
/** 通过原图 Key 找到相应的 WebP 展示变体。 */
export const displayObjectKey = (key: string, variant: DisplayVariant) =>
  key.replace(/\.png$/, `.${variant}.webp`);

export const maxDisplayThumbnailBytes = 256 * 1024;

/** 读取已保存的 WebP 缩略图，限制体积并略过缺失的展示变体。 */
export async function readStoredDisplayThumbnail(bucket: ImageObjectBucket, objectKey: string) {
  if (!objectKey.endsWith(".png")) return null;
  const thumbnail = await bucket.get(displayObjectKey(objectKey, "thumbnail"));
  if (!thumbnail) return null;
  if (thumbnail.size < 1 || thumbnail.size > maxDisplayThumbnailBytes) {
    await thumbnail.body.cancel();
    return null;
  }
  return new Uint8Array(await thumbnail.arrayBuffer());
}

/** 供应商参考图的编码改变时，递增 Key 中的版本以区分旧文件。 */
export const providerReferenceObjectKey = (key: string, extension: "jpg" | "png") =>
  `${key}.provider-v1.${extension}`;
