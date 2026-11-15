import { cloudflareImages } from "@lycoboai/storage/cloudflare";
import { displayObjectKey, displayVariants } from "@lycoboai/storage/variants";
import type { openCloudflareRuntime } from "./cloudflare-runtime";

type ImageRuntime = Awaited<ReturnType<typeof openCloudflareRuntime>>;
type VariantRuntime = {
  repository: Pick<ImageRuntime["repository"], "asset">;
  bucket: Pick<ImageRuntime["bucket"], "head" | "put">;
  store: Pick<ImageRuntime["store"], "read">;
};

/** 查询素材归属后补齐展示变体，原图与已有变体保持不变。 */
export async function processCloudflareVariants(
  job: { assetId: string; organizationId: string },
  env: { IMAGES: Parameters<typeof cloudflareImages>[0] },
  runtime: VariantRuntime,
) {
  // 媒体入口验证签名后才投递消息，消费时仍由数据库确认组织归属。
  const asset = await runtime.repository.asset(
    { organizationId: job.organizationId, userId: job.organizationId },
    job.assetId,
  );
  if (!asset) return;
  const variants = await Promise.all(
    (["thumbnail", "preview"] as const).map(async (variant) => {
      const key = displayObjectKey(asset.objectKey, variant);
      return { key, variant, exists: Boolean(await runtime.bucket.head(key)) };
    }),
  );
  const missing = variants.filter(({ exists }) => !exists);
  if (missing.length === 0) return;
  const codec = cloudflareImages(env.IMAGES);
  const bytes = await runtime.store.read(asset);
  const dimensions = await codec.info(bytes);
  const isSmall =
    dimensions.width <= displayVariants.thumbnail.width &&
    dimensions.height <= displayVariants.thumbnail.height;
  let shared: Uint8Array | undefined;
  for (const { key, variant } of missing) {
    // 两个档位都无需缩放时复用较高清晰度的 WebP；只写缺失的对象。
    const { width, height, quality } = displayVariants[isSmall ? "preview" : variant];
    const encoded = shared ?? (await codec.encode(bytes, width, height, "image/webp", quality));
    if (isSmall) shared = encoded;
    await runtime.bucket.put(key, encoded, {
      httpMetadata: { contentType: "image/webp" },
    });
  }
}
