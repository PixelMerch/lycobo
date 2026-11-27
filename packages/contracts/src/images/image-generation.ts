import { z } from "zod";
import { variationGenerationSchema, variationPlanLimit } from "../planning/variation-plan";
import { textileGenerationSchema } from "./textile-generation";

export const imageLimits = {
  uploadBytes: 10 * 1024 * 1024,
  outputBytes: 32 * 1024 * 1024,
  providerResponseBytes: 45 * 1024 * 1024,
} as const;

export const imageModelIds = [
  "gpt-image-2.6",
  "gpt-image-2.5",
  "gpt-image-2",
  "gpt-image-2-4K",
  "gpt-image-2.5-flare",
  "gpt-image-2.5-sunburst",
  "nano-banana-2.1",
  "gemini-nano-banana-2.1",
] as const;
export const imageModelCodeSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,99}$/);
export const imageResolutionSchema = z.enum(["1K", "1.5K", "2K", "4K"]);
export const publicImageResolutions = ["1.5K", "2K", "4K"] as const;
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

/** 参考图角色：商品保持外观不变、原图是要处理的图、风格只借鉴观感。 */
export const referenceRoleSchema = z.enum(["product", "source", "style"]);
/** 参考图角色。 */
export type ReferenceRole = z.infer<typeof referenceRoleSchema>;

export const imageGenerationInputSchema = z
  .strictObject({
    model: imageModelCodeSchema,
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
      .max(11)
      .default([])
      .refine((ids) => new Set(ids).size === ids.length, "Duplicate references"),
    // 与 referenceAssetIds 一一对应的角色；只在用户标了原图或风格时出现，旧输入缺省、哈希不变。
    referenceRoles: z.array(referenceRoleSchema).max(11).optional(),
    count: z.number().int().min(1).max(variationPlanLimit).default(1),
    // 旧任务快照里缺省，保持已存幂等哈希有效。
    quality: imageQualitySchema.optional(),
    // 旧输入里缺省，保持原有幂等哈希不变。
    localEdit: imageLocalEditSchema.optional(),
    textileSet: textileGenerationSchema.optional(),
    variation: variationGenerationSchema.optional(),
    // 新任务才携带标记，不改变已有任务的幂等输入。
    replica: z.literal(true).optional(),
  })
  .superRefine((input, ctx) => {
    if (!input.replica && input.referenceAssetIds.length > 10)
      ctx.addIssue({ code: "custom", message: "Too many references" });
    if (input.replica) {
      const validRoles =
        input.referenceRoles?.[0] === "style" &&
        input.referenceRoles.slice(1).every((role) => role === "product");
      const mixedTools = !!input.textileSet || !!input.variation || !!input.localEdit;
      if (
        input.referenceAssetIds.length < 2 ||
        !validRoles ||
        mixedTools ||
        (input.referenceAssetIds.length > 2 && input.count !== input.referenceAssetIds.length - 1)
      )
        ctx.addIssue({
          code: "custom",
          message: "Style matching requires one style image and one output per product reference",
        });
    }
  })
  .superRefine((input, ctx) => {
    const maxTextileReferences = (input.textileSet?.version ?? 0) >= 2 ? 6 : 2;
    const invalidImageTask = input.textileSet
      ? input.count !== input.textileSet.views.length ||
        input.referenceAssetIds.length < 1 ||
        input.referenceAssetIds.length > maxTextileReferences ||
        !!input.localEdit
      : input.count > (input.replica ? 10 : 4);
    const invalidCount = input.variation
      ? input.count !== input.variation.items.length ||
        input.referenceAssetIds.length > 5 ||
        !!input.textileSet ||
        !!input.localEdit
      : invalidImageTask;
    if (invalidCount)
      ctx.addIssue({
        code: "custom",
        message:
          "Textile views require one output each and one main reference and up to five detail references; ordinary tasks allow four outputs",
      });

    if (input.referenceRoles && input.referenceRoles.length !== input.referenceAssetIds.length)
      ctx.addIssue({ code: "custom", message: "Reference roles must match references" });
    const taskReferences = new Set(input.referenceAssetIds);
    // 每条方案指定的参考图必须来自本任务，归属已随任务参考图一起校验。
    if (
      input.variation?.items.some((item) =>
        item.referenceAssetIds?.some((id) => !taskReferences.has(id)),
      )
    )
      ctx.addIssue({ code: "custom", message: "Plan item references must belong to the task" });

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

/** 接收独立的用户文字；后台模型仍使用原有生成输入。 */
export const imageTaskSubmissionSchema = imageGenerationInputSchema.safeExtend({
  userPrompt: z.string().max(9000).optional(),
});
/** 图片任务提交请求，包含可选的用户提示词。 */
export type ImageTaskSubmission = z.infer<typeof imageTaskSubmissionSchema>;

/** 按旧任务快照的格式提取用户内容，供回填过渡期和旧客户端提交使用。 */
export function imageUserPrompt(
  prompt: string,
  input?: Pick<ImageGenerationInput, "replica" | "textileSet">,
) {
  if (input?.replica) return prompt.split("\n").slice(1).join("\n");
  if (input?.textileSet) return "";
  return prompt;
}
export type ImageScope = { userId: string; organizationId: string };
/** 私有图片对象的实际保存格式与像素信息。 */
export type StoredImage = {
  id: string;
  objectKey: string;
  mimeType: "image/png" | "image/webp";
  bytes: number;
  width: number;
  height: number;
  sha256: string;
};
// 公开选项与历史任务保留的供应商别名分开，主图型号顺序由产品定义。
export const mainImageModelIds = ["gpt-image-2.6", "gpt-image-2.5", "gpt-image-2"] as const;
export const publicImageModelIds = [...mainImageModelIds, "nano-banana-2.1"] as const;
export type PublicImageModelId = string;
export const imageUnitCredits = 2;
export function publicImageModel(model: ImageGenerationInput["model"]): PublicImageModelId {
  if (model === "gemini-nano-banana-2.1") return "nano-banana-2.1";
  if (model === "gpt-image-2-4K") return "gpt-image-2";
  if (model === "gpt-image-2.5-flare" || model === "gpt-image-2.5-sunburst") return "gpt-image-2.5";
  return model;
}
/** 将公开模型映射到中转站型号，历史别名继续按原规则解析。 */
export function imageProviderModel(input: Pick<ImageGenerationInput, "model" | "resolution">) {
  if (input.model === "gpt-image-2-4K") return "gpt-image-2-4K";
  const model = publicImageModel(input.model);
  if (model === "gpt-image-2.6") return model;
  if (model === "gpt-image-2")
    return input.resolution === "1K" || input.resolution === "1.5K"
      ? "gpt-image-2"
      : "gpt-image-2-4K";
  if (model === "gpt-image-2.5") return "gpt-image-2.5-sunburst";
  return "gemini-nano-banana-2.1";
}
// Public presentation metadata; provider configuration and credentials are never included.
export const imageModelLogosResponseSchema = z.object({
  models: z.array(
    z.object({
      id: imageModelCodeSchema,
      logoUrl: z.url().nullable(),
      name: z.string().max(80).optional(),
      description: z.string().max(160).optional(),
      capabilitySummary: z.string().max(160).optional(),
    }),
  ),
});

const defaultAllowedResolutions: ImageResolution[] = ["1K", ...publicImageResolutions];
export const imageModelCatalog = publicImageModelIds.map((id) => ({
  id,
  allowedResolutions: [...defaultAllowedResolutions],
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
  model: imageModelCodeSchema,
  prompt: z.string(),
  user_prompt: z.string().nullable().optional(),
  submission_source: z.literal("mcp").nullable().optional(),
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
/** 图片创作工具标识，用于历史和素材库的独立筛选。 */
export const imageToolSchema = z.enum(["create", "textile", "variation", "replica"]);
export const assetToolSchema = z.enum(["create", "textile", "variation", "replica", "video"]);
export type AssetTool = z.infer<typeof assetToolSchema>;
export type ImageTool = z.infer<typeof imageToolSchema>;

/** 确定任务的历史入口，已记录来源的 MCP 单张也归入套图。 */
export function imageJobTool(job: Pick<ImageJob, "input" | "submission_source">): ImageTool {
  if (job.input?.replica) return "replica";
  if (job.input?.textileSet) return "textile";
  if (job.input?.variation || job.submission_source === "mcp") return "variation";
  return "create";
}
/** Each member keeps at most this many favorites, so the favorite id list stays bounded. */
export const assetFavoriteLimit = 1000;
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
  /** Tool of the task that produced an output; uploads have none. Optional for older servers. */
  tool: assetToolSchema.nullable().optional(),
  /** Whether the signed-in member favorited the asset. Optional for older servers. */
  favorite: z.boolean().optional(),
  /** Requested length of a generated video. Optional for older servers. */
  duration_seconds: z.number().nullable().optional(),
  /** Resolution tier of the producing task. Optional for older servers. */
  resolution: z.string().nullable().optional(),
});
export type ImageAsset = z.infer<typeof imageAssetSchema>;
export const imageAssetsResponseSchema = z.object({ data: z.array(imageAssetSchema) });
export const assetFavoriteResponseSchema = z.object({ favorite: z.boolean() });
export const assetFavoriteIdsResponseSchema = z.object({ data: z.array(z.uuid()) });
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
    z.object({ id: imageModelCodeSchema, enabledResolutions: z.array(imageResolutionSchema) }),
  ),
});
export const imageTaskRetrySchema = z.object({ itemId: z.uuid().optional() });
export const imageSubmissionResponseSchema = z.object({ id: z.uuid(), replayed: z.boolean() });
export const imageUploadResponseSchema = z.object({
  id: z.uuid(),
  delivery: imageDeliverySchema.optional(),
});

// Overseas Workers accept uploads before Queue processing; existing 201 clients remain supported.
export const imageUploadTicketSchema = z.object({ uploadId: z.uuid() });
export const imageUploadStatusSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("pending") }),
  z.object({ status: z.literal("failed") }),
  z.object({ status: z.literal("succeeded"), asset: imageUploadResponseSchema }),
]);

export const imageSessionResponseSchema = z.object({ userId: z.uuid(), organizationId: z.uuid() });

export const latestImageEditResponseSchema = z.object({ job: imageJobSchema.nullable() });

/** New 1.5K requests use exact pixels; legacy task dimensions remain unchanged. */
export function imageOutputDimensions(ratio: string, resolution: ImageResolution) {
  const [w = 1, h = 1] = ratio.split(":").map(Number);
  const edge = { "1K": 1024, "1.5K": 1254, "2K": 2048, "4K": 3840 }[resolution];
  const scale = edge / Math.max(w, h);
  const alignment = resolution === "1.5K" ? 1 : 16;
  return {
    width: Math.round((w * scale) / alignment) * alignment,
    height: Math.round((h * scale) / alignment) * alignment,
  };
}
