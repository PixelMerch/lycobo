import { z } from "zod";
import {
  variationPlanInputSchema,
  variationPlanItemSchema,
  variationPlanLimit,
} from "../planning/variation-plan";
import { imageGenerationInputSchema, publicImageResolutions } from "./image-generation";

export const imageAutomationPath = "/enterprise/image-api";
export const imageAutomationMcpPath = `${imageAutomationPath}/mcp`;
export const imageAutomationDownloadPath = `${imageAutomationPath}/task-downloads`;
export const imageAutomationReferenceUploadPath = `${imageAutomationPath}/reference-uploads`;
export const imageAutomationKeyPath = `${imageAutomationPath}/key`;
export const imageAutomationKeyCopyPath = `${imageAutomationKeyPath}/copy`;
export const imageAutomationKeyPrefix = "lcb_img_";

export const automationReferenceLimits = { batch: 100, maxEdge: 1600, maxBytes: 1024 * 1024 };
export const automationReferenceSha256 = z.string().regex(/^[a-f0-9]{64}$/);
/** 一次查询一批原文件指纹，重复指纹由调用方合并。 */
export const automationReferenceLookupSchema = z.strictObject({
  fingerprints: z
    .array(automationReferenceSha256)
    .min(1)
    .max(automationReferenceLimits.batch)
    .refine((values) => new Set(values).size === values.length),
});

/** 自动化单图接收提示词、分辨率、宽高比和已准备的参考素材。 */
export const imageAutomationInputSchema = z.strictObject({
  prompt: z.string().trim().min(1).max(5000),
  resolution: z.enum(publicImageResolutions),
  aspectRatio: imageGenerationInputSchema.shape.aspectRatio
    .unwrap()
    .optional()
    .describe("图片宽高比，例如 16:9。传入用户指定或适合用途的比例。"),
  referenceAssetIds: variationPlanInputSchema.shape.referenceAssetIds
    .optional()
    .describe("prepare_reference_uploads 查重或上传返回的素材 ID，最多 5 个。"),
});

/** 一套图共用宽高比和分辨率，每张图可指定独立提示词。 */
export const imageAutomationSetInputSchema = z.strictObject({
  title: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/[\p{L}\p{N}]/u),
  resolution: imageAutomationInputSchema.shape.resolution,
  aspectRatio: imageAutomationInputSchema.shape.aspectRatio,
  referenceAssetIds: imageAutomationInputSchema.shape.referenceAssetIds,
  images: z
    .array(variationPlanItemSchema.omit({ id: true }))
    .min(1)
    .max(variationPlanLimit),
});
export type ImageAutomationSetInput = z.infer<typeof imageAutomationSetInputSchema>;

/** 状态接口返回有效期、遮罩末四位和能否复制。 */
export const imageAutomationKeyStatusSchema = z.object({
  expiresAt: z.iso.datetime().nullable(),
  copyable: z.boolean().optional(),
  lastFour: z
    .string()
    .regex(/^[\w-]{4}$/)
    .optional(),
});
export const imageAutomationKeyIssuedSchema = z.object({
  expiresAt: z.iso.datetime(),
  key: z.string().regex(/^lcb_img_[\w-]{43}$/),
});
export const imageAutomationKeyCopySchema = imageAutomationKeyIssuedSchema.pick({ key: true });
