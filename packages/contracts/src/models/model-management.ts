import { z } from "zod";
import { imageModelCodeSchema, imageResolutionSchema } from "../images/image-generation";

export const providerAdapterSchema = z.enum(["openai-images", "fluxport-images", "gemini-native"]);
export const providerModeSchema = z.enum(["sync", "async-preferred", "provider-default"]);
export const providerOriginSchema = z
  .url()
  .max(300)
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/" &&
      !/^(localhost|.*\.localhost|.*\.local|[\d.]+|\[.*\])$/i.test(url.hostname)
    );
  }, "需要公网HTTPS源地址，不含路径、账号或查询参数");
export const providerInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  origin: providerOriginSchema,
  adapter: providerAdapterSchema,
  enabled: z.boolean(),
  apiKey: z.string().trim().min(8).max(2048).optional(),
});
const upstreamModelSchema = z
  .string()
  .trim()
  .regex(/^[\w.\-:/]{1,160}$/);
export const channelInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  providerId: z.uuid(),
  model: imageModelCodeSchema,
  upstreamModel: upstreamModelSchema,
  adapter: providerAdapterSchema.nullable().optional(),
  upstreamModelsByResolution: z
    .strictObject({
      "1K": upstreamModelSchema.optional(),
      "1.5K": upstreamModelSchema.optional(),
      "2K": upstreamModelSchema.optional(),
      "4K": upstreamModelSchema.optional(),
    })
    .optional(),
  mode: providerModeSchema,
  enabled: z.boolean(),
  editsEnabled: z.boolean(),
  // Historical channel field; resolution now comes from each validated task input.
  resolutions: z.array(imageResolutionSchema).min(1).max(4).default(["1K", "2K", "4K"]),
  maxReferences: z.number().int().min(0).max(10),
  timeoutMs: z.number().int().min(5000).max(600000),
  taskTimeoutSeconds: z.number().int().min(60).max(7200),
  downloadOrigins: z.array(providerOriginSchema).max(8),
});
export const modelRouteInputSchema = z.strictObject({
  tool: z.enum(["create", "textile-set", "local-edit"]),
  model: imageModelCodeSchema,
  channelId: z.uuid(),
});
export const providerSnapshotSchema = channelInputSchema
  .omit({ providerId: true, name: true, enabled: true })
  .extend({
    channelId: z.uuid(),
    credentialId: z.uuid(),
    webhook: z
      .object({
        source: z.string().regex(/^[a-f0-9]{64}$/),
        waitSeconds: z.number().int().min(30).max(120),
      })
      .optional(),
    origin: providerOriginSchema,
    adapter: providerAdapterSchema,
  });
export type ProviderSnapshot = z.infer<typeof providerSnapshotSchema>;

/** 按分辨率选择任务快照中的上游型号，缺省时使用渠道默认型号。 */
export function providerModelForResolution(
  snapshot: Pick<ProviderSnapshot, "upstreamModel" | "upstreamModelsByResolution">,
  resolution: import("../images/image-generation").ImageResolution,
) {
  return (
    snapshot.upstreamModelsByResolution?.[resolution] ??
    (resolution === "1.5K" ? snapshot.upstreamModelsByResolution?.["1K"] : undefined) ??
    snapshot.upstreamModel
  );
}
