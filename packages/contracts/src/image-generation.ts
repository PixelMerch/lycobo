import { z } from "zod";

export const imageLimits = {
  uploadBytes: 10 * 1024 * 1024,
  outputBytes: 32 * 1024 * 1024,
  providerResponseBytes: 45 * 1024 * 1024,
} as const;

export const imageModelIds = [
  "gpt-image-2.5",
  "gpt-image-2",
  "gpt-image-2-4K",
  "gpt-image-2.5-flare",
  "gpt-image-2.5-sunburst",
] as const;
export const imageResolutionSchema = z.enum(["1K", "2K", "4K"]);
export type ImageResolution = z.infer<typeof imageResolutionSchema>;
export const imageGenerationInputSchema = z.strictObject({
  model: z.enum(imageModelIds),
  prompt: z.string().trim().min(1).max(9000),
  resolution: imageResolutionSchema.default("1K"),
  aspectRatio: z
    .enum([
      "1:1",
      "2:3",
      "3:4",
      "4:5",
      "5:4",
      "4:3",
      "9:16",
      "16:9",
      "2:1",
      "3:2",
      "21:9",
      "9:21",
      "1:2",
    ])
    .default("1:1"),
  referenceAssetIds: z
    .array(z.uuid())
    .max(10)
    .default([])
    .refine((ids) => new Set(ids).size === ids.length, "Duplicate references"),
  count: z.number().int().min(1).max(4).default(1),
});
export type ImageGenerationInput = z.infer<typeof imageGenerationInputSchema>;
export type ImageScope = { userId: string; organizationId: string };
export type StoredImage = {
  id: string;
  objectKey: string;
  mimeType: "image/png";
  bytes: number;
  width: number;
  height: number;
  sha256: string;
};
export const imageModelCatalog = imageModelIds.map((id) => ({
  id,
  documentedResolutions: (id === "gpt-image-2"
    ? ["1K"]
    : id === "gpt-image-2-4K"
      ? ["1K", "2K", "4K"]
      : []) as ImageResolution[],
  capabilityStatus: id.startsWith("gpt-image-2.5") ? "unverified" : "documented",
  highResolutionMode: id === "gpt-image-2-4K" ? "enhanced" : null,
}));

export const imageItemStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "needs_reconciliation",
]);
export const imageJobSchema = z.object({
  id: z.uuid(),
  organization_id: z.uuid(),
  user_id: z.uuid(),
  model: z.enum(imageModelIds),
  prompt: z.string(),
  resolution: imageResolutionSchema,
  aspect_ratio: z.string(),
  requested_count: z.number(),
  status: z.enum([
    "queued",
    "running",
    "succeeded",
    "partially_failed",
    "failed",
    "needs_reconciliation",
  ]),
  created_at: z.string(),
  completed_at: z.string().nullable(),
  items: z.array(
    z.object({
      id: z.uuid(),
      position: z.number(),
      status: imageItemStatusSchema,
      output_asset_id: z.uuid().nullable(),
      error_code: z.string().nullable(),
      width: z.number().nullable(),
      height: z.number().nullable(),
      worker_id: z.string().nullable(),
    }),
  ),
});
export type ImageJob = z.infer<typeof imageJobSchema>;
export const imageTasksResponseSchema = z.object({ data: z.array(imageJobSchema) });
export const imageAssetSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["reference", "output"]),
  width: z.number(),
  height: z.number(),
  bytes: z.number(),
  created_at: z.string(),
  model: z.string().nullable(),
  prompt: z.string().nullable(),
});
export type ImageAsset = z.infer<typeof imageAssetSchema>;
export const imageAssetsResponseSchema = z.object({ data: z.array(imageAssetSchema) });
export const imageModelsResponseSchema = z.object({
  enabled: z.boolean(),
  editsEnabled: z.boolean(),
  unitCredits: z.number(),
  models: z.array(
    z.object({ id: z.enum(imageModelIds), enabledResolutions: z.array(imageResolutionSchema) }),
  ),
});
export const imageSubmissionResponseSchema = z.object({ id: z.uuid(), replayed: z.boolean() });
export const imageUploadResponseSchema = z.object({ id: z.uuid() });

export const imageSessionResponseSchema = z.object({ userId: z.uuid(), organizationId: z.uuid() });
