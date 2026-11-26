import type { MessageBatch } from "@cloudflare/workers-types";
import { creemBillingProvider, drainGenerationCredits } from "@lycoboai/billing";
import { openRealtimeRepository } from "@lycoboai/db";
import {
  dispatchImageOutbox,
  dispatchRealtime,
  imageQueueJobSchema,
  imageVariantJobSchema,
} from "@lycoboai/queue";
import { recoverCloudflareUploads, uploadJobSchema } from "@lycoboai/storage/uploads";
import { processImageItem } from "../images/image-processor";
import { type CloudflareImageEnv, openCloudflareRuntime } from "./cloudflare-runtime";
import { processCloudflareVariants } from "./cloudflare-variants";

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
  let needsRealtime = false;
  try {
    for (const message of batch.messages) {
      try {
        const upload = uploadJobSchema.safeParse(message.body);
        if (upload.success) {
          needsRealtime = true;
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
        needsRealtime = true;
        await processImageItem(parsed.data.itemId, {
          repository: runtime.repository,
          prepareReferences: (itemId) => prepareReferences(itemId, runtime),
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
    // 纯变体修复只写 R2，不产生业务事件；其余任务即使部分失败也立即尝试投递。
    await closeAfterRealtime(runtime, env, { enabled: needsRealtime });
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
      const key = env.CREEM_API_KEY?.trim();
      if (
        key?.startsWith("creem_") &&
        (await drainGenerationCredits(creemBillingProvider(key), runtime.repository))
      )
        console.error("BILLING_SETTLEMENT_DEFERRED");
      await dispatchImageOutbox(runtime.repository, env.IMAGE_QUEUE);
    }
    await recoverCloudflareUploads(env.MEDIA, runtime.uploads.recover);
  } finally {
    await closeAfterRealtime(runtime, env, { prune: true });
  }
}

async function closeAfterRealtime(
  runtime: Awaited<ReturnType<typeof openCloudflareRuntime>>,
  env: CloudflareImageEnv,
  options: { prune?: boolean; enabled?: boolean },
) {
  try {
    await flushRealtime(env, options);
  } finally {
    // 推送连接初始化失败时，也必须释放本次消费者的数据库客户端。
    await runtime.repository.close();
  }
}

/** 消费后立即推送，Cron 补偿未送达意图并集中清理历史。 */
async function flushRealtime(
  env: CloudflareImageEnv,
  { prune = false, enabled = true }: { prune?: boolean; enabled?: boolean } = {},
) {
  if (!enabled) return;
  const repository = openRealtimeRepository(env.HYPERDRIVE.connectionString);
  try {
    await dispatchRealtime(repository, env.REALTIME);
    if (prune) await repository.prune();
  } catch {
    console.error("REALTIME_DISPATCH_FAILED");
  } finally {
    await repository.close();
  }
}

/** 参考图上传意图有效时继续排队，确定失败或意图失效才结束。 */
export async function prepareReferences(
  itemId: string,
  runtime: {
    repository: Pick<
      Awaited<ReturnType<typeof openCloudflareRuntime>>["repository"],
      "waitingReferenceUploads"
    >;
    uploads: Pick<Awaited<ReturnType<typeof openCloudflareRuntime>>["uploads"], "status">;
  },
) {
  const waiting = await runtime.repository.waitingReferenceUploads(itemId);
  if (!waiting) return "ready";
  const statuses = await Promise.all(waiting.ids.map((id) => runtime.uploads.status(waiting, id)));
  if (statuses.some((result) => !result || result.status === "failed")) return "failed";
  // 队列积压不影响上传有效期，交给 R2 上传意图判断是否过期。
  return statuses.some((result) => result?.status === "pending") ? "pending" : "ready";
}
