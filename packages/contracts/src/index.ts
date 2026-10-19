import { z } from "zod";

export const taskStatuses = [
  "queued",
  "running",
  "succeeded",
  "partially_failed",
  "failed",
  "cancelled",
] as const;
export const taskStatusSchema = z.enum(taskStatuses);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const createTaskSchema = z.strictObject({
  projectId: z.uuid(),
  prompt: z.string().trim().min(1).max(2000),
  referenceAssetIds: z.array(z.uuid()).min(1).max(8),
  aspectRatio: z.enum(["1:1", "3:4", "4:3", "9:16", "16:9"]),
  count: z.number().int().min(1).max(4),
  idempotencyKey: z.uuid(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const capabilitiesSchema = z.object({
  service: z.literal("lycoboai"),
  stage: z.literal("foundation"),
  generationEnabled: z.literal(false),
  authenticationEnabled: z.literal(false),
});
export type Capabilities = z.infer<typeof capabilitiesSchema>;

export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), requestId: z.string() }),
});

export * from "./image-generation";
