import { z } from "zod";

export const videoModel = "Minimax-h3-933特价";
export const videoUnitCredits = 100;
export const videoRatios = ["9:16", "16:9", "21:9", "4:3", "3:4", "1:1"] as const;
export const videoSeconds = Array.from({ length: 26 }, (_, index) => index + 5);
export const videoInputSchema = z.strictObject({
  prompt: z
    .string()
    .trim()
    .min(1)
    .max(5000)
    .refine((value) => /[\p{L}\p{N}]/u.test(value.replace(/@图片\d+/g, "")), "请输入视频描述"),
  seconds: z.number().int().min(5).max(30),
  aspectRatio: z.enum(videoRatios).default("9:16"),
  referenceAssetIds: z
    .array(z.uuid())
    .max(9)
    .default([])
    .refine((ids) => new Set(ids).size === ids.length),
});
export type VideoInput = z.infer<typeof videoInputSchema>;
export const videoTaskSchema = z.object({
  id: z.uuid(),
  public_id: z.string(),
  prompt: z.string(),
  status: z.enum(["queued", "running", "succeeded", "failed", "needs_reconciliation"]),
  created_at: z.string(),
  input: z.object({ video: videoInputSchema }),
  error_code: z.string().nullable(),
  asset_id: z.uuid().nullable(),
  provider_status: z.string().nullable(),
  delivery: z.object({ url: z.string(), download_url: z.string() }).optional(),
});
export type VideoTask = z.infer<typeof videoTaskSchema>;
export const videoTasksSchema = z.object({ data: z.array(videoTaskSchema) });

export const videoCapabilitySchema = z.object({
  enabled: z.boolean(),
  resolution: z.literal("768p"),
  unitCredits: z.literal(videoUnitCredits),
});
export const videoAcceptedSchema = z.object({ id: z.uuid(), replayed: z.boolean() });
export const pendingVideoSchema = z.object({ key: z.uuid(), input: videoInputSchema });
