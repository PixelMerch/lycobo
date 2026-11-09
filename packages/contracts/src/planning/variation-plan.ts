import { z } from "zod";

export const variationPlanLimit = 20;

export const variationPlanItemSchema = z.strictObject({
  id: z.uuid(),
  title: z.string().trim().min(1).max(40),
  prompt: z.string().trim().min(5).max(4000),
});
export const variationPlanInputSchema = z.strictObject({
  description: z
    .string()
    .trim()
    .min(2)
    .max(5000)
    .refine((text) => /[\p{L}\p{N}]/u.test(text.replace(/@图片[1-9]\d*|@/g, "")), "需要文字需求"),
  referenceAssetIds: z
    .array(z.uuid())
    .max(5)
    .refine((ids) => new Set(ids).size === ids.length),
});
export const variationPlanSchema = z.object({
  id: z.uuid(),
  status: z.enum(["running", "ready", "failed", "uncertain"]),
  referenceAssetIds: z.array(z.uuid()).max(5),
  description: z.string(),
  items: z.array(variationPlanItemSchema).max(variationPlanLimit),
});
export const variationGenerationSchema = z.strictObject({
  version: z.literal(1),
  planId: z.uuid(),
  items: z
    .array(variationPlanItemSchema)
    .min(1)
    .max(variationPlanLimit)
    .refine((items) => new Set(items.map((item) => item.id)).size === items.length),
});
export type VariationPlan = z.infer<typeof variationPlanSchema>;
export type VariationPlanInput = z.infer<typeof variationPlanInputSchema>;
export type VariationGeneration = z.infer<typeof variationGenerationSchema>;

export const pendingVariationPlanSchema = z.object({
  key: z.uuid(),
  input: variationPlanInputSchema,
});
export const variationCapabilitiesSchema = z.object({ enabled: z.boolean() });
