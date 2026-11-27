import { z } from "zod";
import { variationPlanItemSchema, variationPlanLimit } from "../planning/variation-plan";
import { imageGenerationInputSchema, publicImageResolutions } from "./image-generation";

export const imageAutomationPath = "/enterprise/image-api";
export const imageAutomationMcpPath = `${imageAutomationPath}/mcp`;
export const imageAutomationKeyPath = `${imageAutomationPath}/key`;
export const imageAutomationKeyCopyPath = `${imageAutomationKeyPath}/copy`;
export const imageAutomationKeyPrefix = "lcb_img_";

/** 自动化单图接收提示词、公开分辨率和可选宽高比。 */
export const imageAutomationInputSchema = z.strictObject({
  prompt: z.string().trim().min(1).max(5000),
  resolution: z.enum(publicImageResolutions),
  aspectRatio: imageGenerationInputSchema.shape.aspectRatio
    .unwrap()
    .optional()
    .describe("图片宽高比。传入用户指定或适合用途的比例，省略时使用 1:1。"),
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
