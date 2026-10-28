import { z } from "zod";
import { textileGenerationSchema } from "./textile-generation";

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
  "nano-banana-2.1",
  "gemini-nano-banana-2.1",
] as const;
export const imageResolutionSchema = z.enum(["1K", "2K", "4K"]);
export type ImageResolution = z.infer<typeof imageResolutionSchema>;
export const imageQualitySchema = z.enum(["low", "medium", "high"]);
export type ImageQuality = z.infer<typeof imageQualitySchema>;
export const imageLocalEditSchema = z
  .strictObject({
    sourceAssetId: z.uuid(),
    width: z.number().int().positive().max(32768),
    height: z.number().int().positive().max(32768),
    regions: z
      .array(
        z.strictObject({
          id: z.uuid(),
          x: z.number().finite().nonnegative(),
          y: z.number().finite().nonnegative(),
          width: z.number().finite().positive(),
          height: z.number().finite().positive(),
          prompt: z.string().trim().min(1).max(900),
        }),
      )
      .min(1)
      .max(8),
  })
  .superRefine((edit, ctx) => {
    if (
      new Set(edit.regions.map((region) => region.id)).size !== edit.regions.length ||
      edit.regions.some(
        (region) =>
          region.x + region.width > edit.width + 0.01 ||
          region.y + region.height > edit.height + 0.01,
      )
    )
      ctx.addIssue({ code: "custom", message: "Invalid edit region bounds or identifiers" });
  });
export type ImageLocalEdit = z.infer<typeof imageLocalEditSchema>;

export const imageGenerationInputSchema = z
  .strictObject({
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
    count: z.number().int().min(1).max(10).default(1),
    // Keep absent on legacy snapshots so their stored idempotency hashes remain valid.
    quality: imageQualitySchema.optional(),
    // Absent on legacy inputs, preserving their original idempotency hashes.
    localEdit: imageLocalEditSchema.optional(),
    textileSet: textileGenerationSchema.optional(),
  })
  .superRefine((input, ctx) => {
    if (
      input.textileSet
        ? input.count !== input.textileSet.views.length ||
          input.referenceAssetIds.length < 1 ||
          input.referenceAssetIds.length > (input.textileSet.version >= 2 ? 6 : 2) ||
          !!input.localEdit
        : input.count > 4
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Textile views require one output each and one main reference and up to five detail references; ordinary tasks allow four outputs",
      });

    if (
      input.localEdit &&
      (input.count !== 1 ||
        input.referenceAssetIds.length !== 1 ||
        input.referenceAssetIds[0] !== input.localEdit.sourceAssetId)
    )
      ctx.addIssue({
        code: "custom",
        message: "Local edits require exactly their source reference and one output",
      });
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
// Public choices are separate from provider aliases retained for historical tasks.
export const publicImageModelIds = ["gpt-image-2", "gpt-image-2.5", "nano-banana-2.1"] as const;
export type PublicImageModelId = (typeof publicImageModelIds)[number];
export const imageUnitCredits = 20;
export function publicImageModel(model: ImageGenerationInput["model"]): PublicImageModelId {
  if (model.includes("banana")) return "nano-banana-2.1";
  return model.startsWith("gpt-image-2.5") ? "gpt-image-2.5" : "gpt-image-2";
}
export function imageProviderModel(input: Pick<ImageGenerationInput, "model" | "resolution">) {
  if (input.model === "gpt-image-2-4K") return "gpt-image-2-4K";
  const model = publicImageModel(input.model);
  if (model === "gpt-image-2") return input.resolution === "1K" ? "gpt-image-2" : "gpt-image-2-4K";
  if (model === "gpt-image-2.5") return "gpt-image-2.5-sunburst";
  return "gemini-nano-banana-2.1";
}
// Public presentation metadata; provider configuration and credentials are never included.
export const imageModelLogosResponseSchema = z.object({
  models: z.array(
    z.object({
      id: z.enum(publicImageModelIds),
      logoUrl: z.url().nullable(),
      name: z.string().max(80).optional(),
      description: z.string().max(160).optional(),
      capabilitySummary: z.string().max(160).optional(),
    }),
  ),
});

export const imageModelCatalog = publicImageModelIds.map((id) => ({
  id,
  allowedResolutions: ["1K", "2K", "4K"] as ImageResolution[],
}));

export const imageItemStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "needs_reconciliation",
]);
export const imageTaskPublicIdSchema = z.string().regex(/^W[0-9A-Z]{8}$/);
export const imagePublicIdSchema = z.string().regex(/^P[0-9A-Z]{8}$/);
export const imageDeliverySchema = z.object({
  url: z.url(),
  thumbnail_url: z.url(),
  download_url: z.url(),
  expires_at: z.number().int(),
});
export type ImageDelivery = z.infer<typeof imageDeliverySchema>;
export const imageJobSchema = z.object({
  unit_credits: z.number().int().nonnegative().optional(),
  public_id: z.union([imageTaskPublicIdSchema, z.string().regex(/^[1-9][0-9]{9}$/)]).optional(),
  input: imageGenerationInputSchema.optional(),
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
  reference_deliveries: z.record(z.string(), imageDeliverySchema).optional(),
  items: z.array(
    z.object({
      id: z.uuid(),
      position: z.number(),
      status: imageItemStatusSchema,
      output_asset_id: z.uuid().nullable(),
      output_delivery: imageDeliverySchema.optional(),
      output_public_id: z
        .union([imagePublicIdSchema, z.string().regex(/^L[1-9][0-9]{8}$/)])
        .nullable()
        .optional(),
      error_code: z.string().nullable(),
      width: z.number().nullable(),
      height: z.number().nullable(),
      worker_id: z.string().nullable(),
    }),
  ),
});
export type ImageJob = z.infer<typeof imageJobSchema>;
export const imageTasksResponseSchema = z.object({ data: z.array(imageJobSchema) });
export const assetTypeSchema = z.enum(["image", "video", "audio"]);
export type AssetType = z.infer<typeof assetTypeSchema>;
export const imageAssetSchema = z.object({
  delivery: imageDeliverySchema.optional(),
  task_public_id: imageJobSchema.shape.public_id.nullable(),
  public_id: z.union([imagePublicIdSchema, z.string().regex(/^L[1-9][0-9]{8}$/)]).optional(),
  id: z.uuid(),
  kind: z.enum(["reference", "output"]),
  type: assetTypeSchema.default("image"),
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
  tools: z
    .record(
      z.string(),
      z.array(
        z.object({
          id: z.string(),
          enabledResolutions: z.array(imageResolutionSchema),
          editsEnabled: z.boolean(),
          managed: z.boolean(),
          maxReferences: z.number(),
        }),
      ),
    )
    .optional(),
  eventsEnabled: z.boolean().optional(),
  enabled: z.boolean(),
  editsEnabled: z.boolean(),
  unitCredits: z.number(),
  models: z.array(
    z.object({ id: z.enum(imageModelIds), enabledResolutions: z.array(imageResolutionSchema) }),
  ),
});
export const imageTaskRetrySchema = z.object({ itemId: z.uuid().optional() });
export const imageSubmissionResponseSchema = z.object({ id: z.uuid(), replayed: z.boolean() });
export const imageUploadResponseSchema = z.object({
  id: z.uuid(),
  delivery: imageDeliverySchema.optional(),
});

export const imageSessionResponseSchema = z.object({ userId: z.uuid(), organizationId: z.uuid() });

export const latestImageEditResponseSchema = z.object({ job: imageJobSchema.nullable() });
