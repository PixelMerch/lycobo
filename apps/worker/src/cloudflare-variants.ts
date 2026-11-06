import { cloudflareImages } from "@lycoboai/storage/cloudflare";
import { displayObjectKey } from "@lycoboai/storage/variants";
import type { openCloudflareRuntime } from "./cloudflare-runtime";

export async function processCloudflareVariants(
  job: { assetId: string; organizationId: string },
  env: CloudflareEnv,
  runtime: Awaited<ReturnType<typeof openCloudflareRuntime>>,
) {
  // The media endpoint enqueues only after signature verification; PG verifies the asset's tenant.
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
