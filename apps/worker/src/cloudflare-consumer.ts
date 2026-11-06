import type { MessageBatch } from "@cloudflare/workers-types";
import { openRealtimeRepository } from "@lycoboai/db";
import {
  dispatchImageOutbox,
  dispatchRealtime,
  imageQueueJobSchema,
  imageVariantJobSchema,
} from "@lycoboai/queue";
import { uploadJobSchema } from "@lycoboai/storage/uploads";
import { z } from "zod";
import { type CloudflareImageEnv, openCloudflareRuntime } from "./cloudflare-runtime";
import { processCloudflareVariants } from "./cloudflare-variants";
import { processImageItem } from "./image-processor";

/** 独立消费图片消息，传输失败可重试，付费尝试始终受数据库领取保护。 */
export async function consumeCloudflareImages(
  batch: MessageBatch<unknown>,
  env: CloudflareImageEnv,
) {
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
        // 图片上传可单独试用，关闭生成时绝不领取或执行付费任务。
        if (env.CLOUDFLARE_GENERATION_ENABLED !== "true") {
          message.retry({ delaySeconds: 60 });
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
          // 回调可能丢失或先于提交回执到达，延迟消息只核查原任务，不重投生图。
          onWebhookAccepted: (ready) => {
            nextPollMs = ready ? 2000 : 60000;
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
    await flushRealtime(env);
    await runtime.repository.close();
  }
}

/** 定时修复持久意图的投递间隙，消息不作为任务或账务依据。 */
export async function dispatchCloudflareImages(env: CloudflareImageEnv) {
  if (env.CLOUDFLARE_CONSUMER_ENABLED !== "true") return;
  const runtime = await openCloudflareRuntime(env);
  try {
    // 试用期间也不改变历史付费任务的租约、账务或投递状态。
    if (env.CLOUDFLARE_GENERATION_ENABLED === "true") {
      await runtime.repository.expireClaims();
      await dispatchImageOutbox(runtime.repository, env.IMAGE_QUEUE);
    }
    await recoverUploads(env, runtime.uploads.recover);
  } finally {
    await flushRealtime(env);
    await runtime.repository.close();
  }
}

async function recoverUploads(env: CloudflareImageEnv, recover: (id: string) => Promise<void>) {
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

/** 每次消费完成立即推送，Cron 同时补偿 API 或 Queue 中断留下的意图。 */
async function flushRealtime(env: CloudflareImageEnv) {
  const repository = openRealtimeRepository(env.HYPERDRIVE.connectionString);
  try {
    await dispatchRealtime(repository, env.REALTIME);
    await repository.prune();
  } catch {
    console.error("REALTIME_DISPATCH_FAILED");
  } finally {
    await repository.close();
  }
}
