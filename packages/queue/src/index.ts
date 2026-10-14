import { Queue } from "bullmq";
import { z } from "zod";
export const diagnosticQueueName = "lycoboai-system-check";
export const diagnosticJobSchema = z.strictObject({ runId: z.uuid() });
export type DiagnosticJob = z.infer<typeof diagnosticJobSchema>;
export function redisConnection(url: string) {
  const parsed = new URL(url);
  if (!["redis:", "rediss:"].includes(parsed.protocol)) throw new Error("Invalid Redis protocol");
  const db = Number(parsed.pathname.slice(1) || 0);
  if (!Number.isSafeInteger(db) || db < 0) throw new Error("Invalid Redis database");
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    db,
    ...(parsed.username ? { username: decodeURIComponent(parsed.username) } : {}),
    ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
    ...(parsed.protocol === "rediss:" ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}
export function createDiagnosticQueue(url: string) {
  return new Queue<DiagnosticJob>(diagnosticQueueName, {
    connection: redisConnection(url),
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 },
    },
  });
}
