import { serve } from "@hono/node-server";
import { servePrivateAsset } from "@lycoboai/storage/asset-server";
import { imageObjectBucket } from "@lycoboai/storage/s3";

const secret = process.env.ASSET_SIGNING_SECRET;
if (!secret || !process.env.ASSET_ALLOWED_ORIGINS) throw new Error("ASSET_CONFIGURATION_REQUIRED");
const bucket = imageObjectBucket(process.env);
const server = serve({
  hostname: process.env.API_HOST ?? "127.0.0.1",
  port: 8791,
  fetch: async (request) => {
    if (new URL(request.url).pathname === "/health") return new Response(null, { status: 204 });
    try {
      return await servePrivateAsset(request, {
        bucket,
        signingSecret: secret,
        allowedOrigins: process.env.ASSET_ALLOWED_ORIGINS ?? "",
      });
    } catch {
      return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => server.close());
