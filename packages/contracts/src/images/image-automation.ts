import { z } from "zod";
import { variationPlanItemSchema, variationPlanLimit } from "../planning/variation-plan";
import { publicImageResolutions } from "./image-generation";

export const imageAutomationPath = "/enterprise/image-api";
export const imageAutomationMcpPath = `${imageAutomationPath}/mcp`;
export const imageAutomationKeyPath = `${imageAutomationPath}/key`;
export const imageAutomationKeyCopyPath = `${imageAutomationKeyPath}/copy`;
export const imageAutomationKeyPrefix = "lcb_img_";

/** 自动化接口接收一张方图的提示词和公开分辨率。 */
export const imageAutomationInputSchema = z.strictObject({
  prompt: z.string().trim().min(1).max(5000),
  resolution: z.enum(publicImageResolutions),
});

/** 一次接收一套方图，每张可指定独立提示词。 */
export const imageAutomationSetInputSchema = z.strictObject({
  title: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/[\p{L}\p{N}]/u),
  resolution: imageAutomationInputSchema.shape.resolution,
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
