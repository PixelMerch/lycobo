import type { ImageObjectBucket } from "../buckets/object-bucket";
import type { ImageOutputSize, ImageStorageTiming } from "../images/core";
import { type DisplayVariant, displayObjectKey, displayVariants } from "../images/image-variants";
import type { cloudflareImages } from "./cloudflare-images";

type Codec = ReturnType<typeof cloudflareImages>;
type Timing = ((event: ImageStorageTiming) => void) | undefined;

/** 记录阶段耗时，诊断回调失败不能改变图片保存结果。 */
export async function timeImageWrite<T>(
  stage: ImageStorageTiming["stage"],
  operation: () => Promise<T>,
  report: Timing,
) {
  const started = performance.now();
  try {
    return await operation();
  } finally {
    try {
      report?.({ stage, durationMs: Math.round(performance.now() - started) });
    } catch {
      // 遥测故障不影响图片持久化。
    }
  }
}

/** 原始付费结果与规范化并行，但失败返回前仍等待源图写入完成。 */
export async function preserveAndNormalize<T>(
  bucket: ImageObjectBucket,
  key: string,
  input: Uint8Array,
  normalize: () => Promise<T>,
  report?: Timing,
) {
  const [source, normalized] = await Promise.allSettled([
    timeImageWrite(
      "image_source_put",
      () =>
        bucket.put(`${key}.source`, input, {
          httpMetadata: { contentType: "application/octet-stream" },
        }),
      report,
    ),
    timeImageWrite("image_encode", normalize, report),
  ]);
  if (source.status === "rejected") throw source.reason;
  if (normalized.status === "rejected") throw normalized.reason;
  return normalized.value;
}

/** 仅处理已校验的 PNG，原图与两个展示变体各自独立写入，最多三路并行。 */
export async function persistImageOutput(
  bucket: ImageObjectBucket,
  codec: Pick<Codec, "encode">,
  key: string,
  data: Uint8Array,
  report: Timing,
  dimensions?: ImageOutputSize,
) {
  const encode = (variant: DisplayVariant) => {
    const { width, height, quality } = displayVariants[variant];
    // 入库前已确认尺寸和格式，派生图直接使用已校验的 PNG。
    return timeImageWrite(
      "image_variant_encode",
      () => codec.encode(data, width, height, "image/webp", quality),
      report,
    );
  };
  // 小图在两个档位都无需缩放，复用清晰度更高的 WebP。
  const shared =
    dimensions &&
    dimensions.width <= displayVariants.thumbnail.width &&
    dimensions.height <= displayVariants.thumbnail.height
      ? encode("preview")
      : undefined;
  const [original, ...variants] = await Promise.allSettled([
    timeImageWrite(
      "image_original_put",
      () => bucket.put(key, data, { httpMetadata: { contentType: "image/png" } }),
      report,
    ),
    ...(["thumbnail", "preview"] as const).map(async (variant) => {
      const bytes = await (shared ?? encode(variant));
      await timeImageWrite(
        "image_variant_put",
        () =>
          bucket.put(displayObjectKey(key, variant), bytes, {
            httpMetadata: { contentType: "image/webp" },
          }),
        report,
      );
    }),
  ]);
  if (original.status === "rejected") throw original.reason;
  // 原图已保存，后续访问可按需补齐展示变体。
  if (variants.some((variant) => variant.status === "rejected"))
    console.warn("IMAGE_DISPLAY_VARIANT_UNAVAILABLE");
}
