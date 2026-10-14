import { diagnosticQueueName, redisConnection } from "@lycoboai/queue";
import { Worker } from "bullmq";
import pino from "pino";
import { z } from "zod";
import { processDiagnostic } from "./processor";

const logger = pino();
const env = z
  .object({
    WORKER_ENABLED: z.enum(["true", "false"]).default("false"),
    REDIS_URL: z.url().optional(),
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(2),
  })
  .safeParse(process.env);
if (!env.success) throw new Error("Invalid worker configuration; check .env.example.");
if (env.data.WORKER_ENABLED === "false") {
  logger.info("Diagnostic worker disabled. Set WORKER_ENABLED=true and REDIS_URL to opt in.");
} else {
  if (!env.data.REDIS_URL) throw new Error("REDIS_URL is required when the worker is enabled.");
  const worker = new Worker(
    diagnosticQueueName,
    async (job) => processDiagnostic(job.name, job.data),
    {
      connection: redisConnection(env.data.REDIS_URL),
      concurrency: env.data.WORKER_CONCURRENCY,
    },
  );
  worker.on("ready", () =>
    logger.info("Diagnostic worker ready; no image provider is configured."),
  );
  worker.on("error", () => logger.error("Worker connection error"));
  worker.on("failed", (job) => logger.warn({ jobId: job?.id }, "Diagnostic job failed"));
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    const deadline = setTimeout(() => process.exit(1), 15_000).unref();
    try {
      await worker.close();
    } catch {
      process.exitCode = 1;
    } finally {
      clearTimeout(deadline);
    }
  };
  process.once("SIGINT", () => {
    void close();
  });
  process.once("SIGTERM", () => {
    void close();
  });
}
