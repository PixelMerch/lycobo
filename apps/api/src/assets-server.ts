import { serve } from "@hono/node-server";
import { servePrivateAsset } from "@lycoboai/storage/asset-server";
import { cloudbaseDownloadSigner, cloudbaseObjectBucket } from "@lycoboai/storage/cloudbase";
import { videoVariantCache } from "@lycoboai/storage/video-variants";
import { z } from "zod";

const env = z
  .object({
    ASSET_SIGNING_SECRET: z.string().min(32),
    ASSET_ALLOWED_ORIGINS: z.string().min(1),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(9000),
  })
  .parse(process.env);
for (const origin of env.ASSET_ALLOWED_ORIGINS.split(",")) {
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.origin !== origin) throw new Error("INVALID_ASSET_ORIGIN");
}
const bucket = cloudbaseObjectBucket(process.env);
const options = {
  bucket,
  createVideoVariant: videoVariantCache(bucket),
  signingSecret: env.ASSET_SIGNING_SECRET,
  allowedOrigins: env.ASSET_ALLOWED_ORIGINS,
  signDownload: cloudbaseDownloadSigner(process.env),
};
const server = serve({
  hostname: "0.0.0.0",
  port: env.API_PORT,
  fetch: async (request) => {
    try {
      const response = await servePrivateAsset(request, options);
      // The CloudBase HTTP gateway owns CORS headers.
      response.headers.delete("Access-Control-Allow-Origin");
      return response;
    } catch {
      return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  },
});
process.once("SIGTERM", () => server.close());
process.once("SIGINT", () => server.close());
