import { hostname } from "node:os";
import { isAbsolute } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { openImageRepository } from "@lycoboai/db";
import { readImagePolicy } from "@lycoboai/generation";
import {
  createImageQueue,
  imageQueueJobSchema,
  imageQueueName,
  redisConnection,
} from "@lycoboai/queue";
import { imageStore } from "@lycoboai/storage";
import { Worker } from "bullmq";
import pino from "pino";
import { z } from "zod";
import { processImageItem } from "./image-processor";

export async function startImageWorker(input: NodeJS.ProcessEnv = process.env) {
  const policy = readImagePolicy(input);
  const config = z
    .object({
      DATABASE_URL: z.url(),
      REDIS_URL: z.url(),
      VAKV_API_KEY: z.string().min(1),
      VAKV_BASE_URL: z.url().default("https://api.vakv.cn"),
      IMAGE_DATA_DIR: z.string().min(1).refine(isAbsolute),
      IMAGE_WORKER_ID: z
        .string()
        .min(1)
        .max(200)
        .default(`${hostname()}-${process.pid}-${crypto.randomUUID()}`),
      GENERATION_TIMEOUT_MS: z.coerce.number().int().min(1000).max(900000).default(300000),
      IMAGE_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(2),
    })
    .safeParse(input);
  if (!config.success || !policy.enabled)
    throw new Error("Image worker requires explicit configuration and enabled policy");
  const env = config.data;
  const base = new URL(env.VAKV_BASE_URL);
  if (
    base.protocol !== "https:" ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  )
    throw new Error("Provider origin must be HTTPS");
  const logger = pino();
  const repository = openImageRepository(env.DATABASE_URL),
    store = imageStore(env.IMAGE_DATA_DIR);
  await store.ready();
  const queue = createImageQueue(env.REDIS_URL);
  const worker = new Worker(
    imageQueueName,
    async (job) => {
      const payload = imageQueueJobSchema.parse(job.data);
      await processImageItem(payload.itemId, {
        repository,
        store,
        workerId: env.IMAGE_WORKER_ID,
        provider: {
          key: env.VAKV_API_KEY,
          baseUrl: env.VAKV_BASE_URL,
          timeoutMs: env.GENERATION_TIMEOUT_MS,
        },
        overrides: policy.overrides,
        editsEnabled: policy.editsEnabled,
      });
    },
    {
      connection: redisConnection(env.REDIS_URL),
      concurrency: env.IMAGE_WORKER_CONCURRENCY,
      maxStalledCount: 0,
    },
  );
  worker.on("error", () => logger.error("Image worker queue connection unavailable"));
  worker.on("failed", (job) =>
    logger.warn({ jobId: job?.id }, "Image worker interrupted; inspect durable task state"),
  );
  queue.on("error", () => logger.error("Image outbox transport unavailable"));
  const stopping = new AbortController();
  const stop = () => stopping.abort();
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  logger.info({ workerId: env.IMAGE_WORKER_ID }, "Image worker started");
  let nextEventCleanup = 0;
  try {
    while (!stopping.signal.aborted) {
      try {
        await repository.expireClaims();
        if (Date.now() >= nextEventCleanup) {
          await repository.pruneEvents();
          nextEventCleanup = Date.now() + 60 * 60 * 1000;
        }
        const events = await repository.leaseOutbox();
        for (const event of events) {
          // No network request occurs inside the leasing database transaction.
          const previous = await queue.getJob(event.id);
          if (previous && ["failed", "completed"].includes(await previous.getState()))
            await previous.remove();
          await queue.add("generate-image", { itemId: event.itemId }, { jobId: event.id });
          await repository.ackOutbox(event.id, event.leaseToken);
        }
      } catch {
        logger.error("Image outbox/database unavailable; paid attempts are not replayed");
      }
      await pause(1000, undefined, { signal: stopping.signal }).catch(() => {});
    }
  } finally {
    const deadline = setTimeout(() => process.exit(1), env.GENERATION_TIMEOUT_MS + 65000).unref();
    try {
      await worker.close();
      await queue.close();
      await repository.close();
    } finally {
      clearTimeout(deadline);
      process.removeListener("SIGTERM", stop);
      process.removeListener("SIGINT", stop);
    }
  }
}
