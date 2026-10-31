import { servePrivateAsset } from "@lycoboai/storage/asset-server";
import { imageObjectBucket, type StorageBindings } from "@lycoboai/storage/s3";
import { displayImage } from "@lycoboai/storage/variants";
export interface AssetBindings extends StorageBindings {
  IMAGES?: ImagesBinding;
  IMAGES_BUCKET: R2Bucket;
  ASSET_SIGNING_SECRET: string;
  ASSET_ALLOWED_ORIGINS: string;
}
export function serveAsset(
  request: Request,
  env: AssetBindings,
  context: Pick<ExecutionContext, "waitUntil">,
  cache: Pick<Cache, "match" | "put">,
) {
  const images = env.IMAGES;
  return servePrivateAsset(request, {
    bucket: imageObjectBucket(env, env.IMAGES_BUCKET),
    signingSecret: env.ASSET_SIGNING_SECRET,
    allowedOrigins: env.ASSET_ALLOWED_ORIGINS,
    ...(images ? { createVariant: (body, variant) => displayImage(images, body, variant) } : {}),
    cache,
    background: (work) => context.waitUntil(work),
  });
}
export default {
  async fetch(request, env, context) {
    try {
      return await serveAsset(request, env, context, caches.default);
    } catch {
      console.error("ASSET_REQUEST_FAILED");
      return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  },
} satisfies ExportedHandler<AssetBindings>;
