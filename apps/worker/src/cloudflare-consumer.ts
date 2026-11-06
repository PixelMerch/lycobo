import type { MessageBatch } from "@cloudflare/workers-types";
import { dispatchImageOutbox, imageQueueJobSchema, imageVariantJobSchema } from "@lycoboai/queue";
import { uploadJobSchema } from "@lycoboai/storage/uploads";
import { z } from "zod";
import { openCloudflareRuntime } from "./cloudflare-runtime";
import { processCloudflareVariants } from "./cloudflare-variants";
import { processImageItem } from "./image-processor";

/** Only transport failures retry messages. Database claims fence all paid attempts. */
export async function consumeCloudflareImages(batch: MessageBatch<unknown>, env: CloudflareEnv) {
  if (env.CLOUDFLARE_CONSUMER_ENABLED !== "true") {
    batch.retryAll({ delaySeconds: 60 });
    return;
  }
  const runtime = await openCloudflareRuntime(env);
  try {
    for (const message of batch.messages) {
      try {
        const upload = uploadJobSchema.safeParse(message.body);
        if (upload.success) {
          await runtime.uploads.process(upload.data.uploadId);
          message.ack();
          continue;
        }
        const variant = imageVariantJobSchema.safeParse(message.body);
        if (variant.success) {
          await processCloudflareVariants(variant.data, env, runtime);
          message.ack();
          continue;
        }
        const parsed = imageQueueJobSchema.safeParse(message.body);
        if (!parsed.success) {
          console.error("INVALID_IMAGE_QUEUE_MESSAGE");
          message.retry({ delaySeconds: 30 });
          continue;
        }
        let nextPollMs: number | undefined;
        await processImageItem(parsed.data.itemId, {
          repository: runtime.repository,
          store: runtime.store,
          workerId: `cloudflare:${crypto.randomUUID()}`,
          standaloneKey: env.STANDALONE_IMAGE_API_KEY,
          overrides: runtime.policy.overrides,
          editsEnabled: runtime.policy.editsEnabled,
          requireMainImageReferenceUrls: true,
          deliverReference: runtime.deliverReference,
          onDeferred: (delayMs) => {
            nextPollMs = delayMs;
          },
          onTiming: (event) => console.info({ event: "IMAGE_STAGE", ...event }),
        });
        if (nextPollMs !== undefined)
          await env.IMAGE_QUEUE.send(parsed.data, {
            delaySeconds: Math.max(2, Math.ceil(nextPollMs / 1000)),
          });
        message.ack();
      } catch {
        message.retry({ delaySeconds: 30 });
        console.error("IMAGE_QUEUE_CONSUMPTION_FAILED");
      }
    }
  } finally {
    await runtime.repository.close();
  }
}

/** Cron repairs send/ack gaps; messages are wake-ups, never the task or billing authority. */
export async function dispatchCloudflareImages(env: CloudflareEnv) {
  if (env.CLOUDFLARE_CONSUMER_ENABLED !== "true") return;
  const runtime = await openCloudflareRuntime(env);
  try {
    await runtime.repository.expireClaims();
    await dispatchImageOutbox(runtime.repository, env.IMAGE_QUEUE);
    await recoverUploads(env, runtime.uploads.recover);
  } finally {
    await runtime.repository.close();
  }
}

async function recoverUploads(env: CloudflareEnv, recover: (id: string) => Promise<void>) {
  const stored = await env.MEDIA.get("_upload-scan-cursor");
  const cursor = stored ? await stored.text() : undefined;
  const page = await env.MEDIA.list({
    prefix: "_uploads/",
    limit: 100,
    ...(cursor ? { cursor } : {}),
  });
  for (const object of page.objects) {
    if (object.key.endsWith(".bin") && object.uploaded.getTime() < Date.now() - 86400000) {
      await env.MEDIA.delete(object.key);
      continue;
    }
    if (!object.key.endsWith(".json")) continue;
    const id = z.uuid().safeParse(object.key.slice(9, -5));
    if (id.success) await recover(id.data);
  }
  if (page.truncated) await env.MEDIA.put("_upload-scan-cursor", page.cursor);
  else await env.MEDIA.delete("_upload-scan-cursor");
}
