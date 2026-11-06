import { cloudflareImages } from "@lycoboai/storage/cloudflare";
import { displayObjectKey } from "@lycoboai/storage/variants";
import type { CloudflareImageEnv, openCloudflareRuntime } from "./cloudflare-runtime";

/** 查询素材归属后补齐展示变体，原图与已有变体保持不变。 */
export async function processCloudflareVariants(
  job: { assetId: string; organizationId: string },
  env: CloudflareImageEnv,
  runtime: Awaited<ReturnType<typeof openCloudflareRuntime>>,
) {
  // 媒体入口验证签名后才投递消息，消费时仍由数据库确认组织归属。
  const asset = await runtime.repository.asset(
    { organizationId: job.organizationId, userId: job.organizationId },
    job.assetId,
  );
  if (!asset) return;
  const codec = cloudflareImages(env.IMAGES);
  const bytes = await runtime.store.read(asset);
  for (const variant of ["thumbnail", "preview"] as const) {
    const key = displayObjectKey(asset.objectKey, variant);
    if (await runtime.bucket.head(key)) continue;
    await runtime.bucket.put(key, await codec.variant(bytes, variant), {
      httpMetadata: { contentType: "image/webp" },
    });
  }
}
