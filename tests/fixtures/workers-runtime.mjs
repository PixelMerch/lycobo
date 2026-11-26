import { realtimeRuntime } from "./realtime-runtime.mjs";

export { RealtimeHub } from "../../apps/api/src/features/realtime/object";

import { hashPassword, verifyPassword } from "../../apps/api/src/features/auth/password";
import { verifyPasswordTurnstile } from "../../apps/api/src/features/auth/password-turnstile";
import { processCloudflareVariants } from "../../apps/worker/src/cloudflare/cloudflare-variants";
import { cloudflareImages } from "../../packages/storage/src/cloudflare/cloudflare-images";
import { recoverCloudflareUploads } from "../../packages/storage/src/cloudflare/cloudflare-uploads";
import { optimizerRuntimeProbe } from "./optimizer-runtime.mjs";

async function turnstileRuntimeProbe() {
  let requests = 0;
  const verify = (response) =>
    verifyPasswordTurnstile(
      "fixture-secret",
      "fixture-token",
      "https://example.com",
      undefined,
      async (input, init) => {
        // 用真实 workerd Request 构造器检查选项，响应由隔离 fixture 提供。
        const outgoing = new Request(input, init);
        requests++;
        if (outgoing.method !== "POST" || outgoing.redirect !== "manual")
          throw new Error("SITEVERIFY_REQUEST_MISMATCH");
        return response;
      },
    );
  const verified = await verify(
    Response.json({ success: true, action: "password_login", hostname: "example.com" }),
  );
  const redirected = await verify(Response.redirect("https://redirect.example", 307));
  return { verified, redirected, requests };
}

async function rateLimitRuntimeProbe(limiter) {
  const key = crypto.randomUUID();
  const attempts = [];
  for (let index = 0; index < 3; index++) attempts.push((await limiter.limit({ key })).success);
  const independent = await limiter.limit({ key: crypto.randomUUID() });
  return { attempts, independent: independent.success };
}

/** 隔离本地运行时探测，不进入生产 Worker，也不调用真实付费模型。 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/fixture/"))
      return realtimeRuntime(request, env);
    if (url.pathname === "/optimizer-runtime") return Response.json(await optimizerRuntimeProbe());
    if (url.pathname === "/turnstile-runtime") return Response.json(await turnstileRuntimeProbe());
    if (url.pathname === "/rate-limit-runtime")
      return Response.json(await rateLimitRuntimeProbe(env.FIXTURE_RATE_LIMIT));
    if (url.pathname === "/queue-result")
      return Response.json({
        completed: !!(await env.MEDIA.head(`queue-${url.searchParams.get("id")}`)),
      });
    const password = await hashPassword("fixture-password");
    const nodeHash =
      "scrypt-v1$00000000000000000000000000000000$de555319949a34b4dbe81df22b8078398d26965e746300f0d352ee91f8ef94f4e312ec4c870cb3dac262c798815b3d1e2166fdd01f12af7b121bbf1ffeaea613";
    if (!(await verifyPassword("fixture-password", nodeHash)))
      throw new Error("NODE_KDF_COMPATIBILITY_FAILED");
    if (!(await verifyPassword("fixture-password", password))) throw new Error("KDF_FAILED");
    const bytes = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADklEQVQImWP4DwYMEAoAU7oL9W/sIDEAAAAASUVORK5CYII=",
      ),
      (value) => value.charCodeAt(0),
    );
    const codec = cloudflareImages(env.IMAGES);
    const metadata = await codec.info(bytes);
    let transformations = 0;
    const runtime = {
      repository: { asset: async () => ({ objectKey: "fixture.png" }) },
      store: { read: async () => bytes },
      bucket: env.MEDIA,
    };
    const job = { assetId: crypto.randomUUID(), organizationId: crypto.randomUUID() };
    const binding = {
      IMAGES: {
        info: (stream) => env.IMAGES.info(stream),
        input: (stream) => {
          transformations++;
          return env.IMAGES.input(stream);
        },
      },
    };
    await processCloudflareVariants(job, binding, runtime);
    await processCloudflareVariants(job, binding, runtime);
    if (transformations !== 1) throw new Error("DUPLICATE_VARIANT_TRANSFORM");
    const stored = await env.MEDIA.get("fixture.preview.webp");
    const thumbnail = await env.MEDIA.get("fixture.thumbnail.webp");
    if (!stored || !thumbnail) throw new Error("VARIANT_MISSING");
    const previewInfo = await codec.info(new Uint8Array(await stored.arrayBuffer()));
    const thumbnailInfo = await codec.info(new Uint8Array(await thumbnail.arrayBuffer()));
    if (previewInfo.format !== "image/webp" || thumbnailInfo.width !== 2)
      throw new Error("VARIANT_FORMAT_MISMATCH");
    const runId = crypto.randomUUID();
    await env.MEDIA.put(`_uploads/${runId}.json`, "{}", {
      customMetadata: { status: "succeeded", expiresAt: String(Date.now() + 60_000) },
    });
    await recoverCloudflareUploads(env.MEDIA, async () => {
      throw new Error("TERMINAL_UPLOAD_WAS_RECOVERED");
    });
    await env.IMAGE_QUEUE.send({ runId });
    return Response.json({
      runId,
      passwordVerified: true,
      width: metadata.width,
      storedBytes: stored?.size,
    });
  },
  async queue(batch, env) {
    for (const message of batch.messages) {
      await env.MEDIA.put(`queue-${message.body.runId}`, "processed");
      message.ack();
    }
  },
};
