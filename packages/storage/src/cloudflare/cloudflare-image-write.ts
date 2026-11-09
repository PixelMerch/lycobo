import type { ImageObjectBucket } from "../buckets/object-bucket";
import type { ImageStorageTiming } from "../images/core";
import { displayObjectKey, displayVariants } from "../images/image-variants";
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
export async function preserveAndNormalize(
  bucket: ImageObjectBucket,
  key: string,
  input: Uint8Array,
  normalize: () => Promise<Uint8Array>,
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
) {
  const writes = await Promise.allSettled([
    timeImageWrite(
      "image_original_put",
      () => bucket.put(key, data, { httpMetadata: { contentType: "image/png" } }),
      report,
    ),
    ...(["thumbnail", "preview"] as const).map(async (variant) => {
      const { width, height, quality } = displayVariants[variant];
      // 调用方已验证同一份规范化图片，不为每个变体重复读取元信息。
      const bytes = await timeImageWrite(
        "image_variant_encode",
        () => codec.encode(data, width, height, "image/webp", quality),
        report,
      );
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
  // 等待所有分支结束后才返回失败，保留源图，防止后台写入越过消费生命周期。
  const failed = writes.find((write) => write.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
}
