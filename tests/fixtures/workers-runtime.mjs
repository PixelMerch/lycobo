import { realtimeRuntime } from "./realtime-runtime.mjs";

export { RealtimeHub } from "../../apps/api/src/features/realtime/object";

import { hashPassword, verifyPassword } from "../../apps/api/src/features/auth/password";
import { cloudflareImages } from "../../packages/storage/src/cloudflare/cloudflare-images";
import { recoverCloudflareUploads } from "../../packages/storage/src/cloudflare/cloudflare-uploads";
import { displayVariants } from "../../packages/storage/src/images/image-variants";
import { optimizerRuntimeProbe } from "./optimizer-runtime.mjs";

/** 隔离本地运行时探测，不进入生产 Worker，也不调用真实付费模型。 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/fixture/"))
      return realtimeRuntime(request, env);
    if (url.pathname === "/optimizer-runtime") return Response.json(await optimizerRuntimeProbe());
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
    const { width, height, quality } = displayVariants.preview;
    const preview = await codec.encode(bytes, width, height, "image/webp", quality);
    await env.MEDIA.put("fixture.webp", preview);
    const stored = await env.MEDIA.head("fixture.webp");
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
