import type { ExportedHandler } from "@cloudflare/workers-types";
import { businessCodes } from "@lycoboai/contracts";
import { imageVariantJobSchema } from "@lycoboai/queue";
import { servePrivateAsset } from "@lycoboai/storage/asset-server";
import { r2ObjectBucket } from "@lycoboai/storage/cloudflare";
import { serveCloudflareApi } from "./cloudflare-app";

/** 提供前端、Hono API 和鉴权媒体访问；图片处理仅投递到独立消费者。 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) return await serveCloudflareApi(request, env);
      if (url.pathname.startsWith(env.ASSET_PATH_PREFIX)) {
        if (url.pathname.includes(".mp4")) return new Response(null, { status: 404 });
        url.pathname = url.pathname.slice(env.ASSET_PATH_PREFIX.length - 1);
        return await servePrivateAsset(new Request(url, request), {
          bucket: r2ObjectBucket(env.MEDIA),
          signingSecret: env.ASSET_SIGNING_SECRET,
          allowedOrigins: env.ASSET_ALLOWED_ORIGINS,
          queueVariant: async (key) => {
            if (env.CLOUDFLARE_CONSUMER_ENABLED !== "true") return;
            const [, organizationId, filename] = key.split("/");
            await env.IMAGE_QUEUE.send(
              imageVariantJobSchema.parse({
                version: 1,
                organizationId,
                assetId: filename?.replace(/\.png$/, ""),
              }),
            );
          },
          cache: caches.default,
          background: (work) => ctx.waitUntil(work),
        });
      }
      return env.ASSETS.fetch(request);
    } catch {
      console.error("CLOUDFLARE_REQUEST_FAILED");
      return Response.json(
        {
          request_id: crypto.randomUUID(),
          code: businessCodes.INTERNAL_ERROR,
          message: "服务暂时不可用",
          data: {},
          error: { code: "INTERNAL_ERROR" },
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  },
} satisfies ExportedHandler<CloudflareEnv>;
