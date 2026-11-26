import { z } from "zod";
import { publicImageResolutions } from "./image-generation";

export const imageAutomationPath = "/enterprise/image-api";
export const imageAutomationMcpPath = `${imageAutomationPath}/mcp`;
export const imageAutomationKeyPrefix = "lcb_img_";

/** 自动化接口接收一张方图的提示词和公开分辨率。 */
export const imageAutomationInputSchema = z.strictObject({
  prompt: z.string().trim().min(1).max(5000),
  resolution: z.enum(publicImageResolutions),
});

export const imageAutomationKeyStatusSchema = z.object({ expiresAt: z.iso.datetime().nullable() });
export const imageAutomationKeyIssuedSchema = z.object({
  expiresAt: z.iso.datetime(),
  key: z.string().regex(/^lcb_img_[\w-]{43}$/),
});
