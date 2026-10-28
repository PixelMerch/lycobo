import { z } from "zod";
import { imageModelCodeSchema, imageResolutionSchema } from "./image-generation";

export const providerAdapterSchema = z.enum(["openai-images", "fluxport-images"]);
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
  upstreamModelsByResolution: z
    .strictObject({
      "1K": upstreamModelSchema.optional(),
      "2K": upstreamModelSchema.optional(),
      "4K": upstreamModelSchema.optional(),
    })
    .optional(),
  mode: providerModeSchema,
  enabled: z.boolean(),
  editsEnabled: z.boolean(),
  resolutions: z.array(imageResolutionSchema).min(1).max(3),
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
    origin: providerOriginSchema,
    adapter: providerAdapterSchema,
  });
export type ProviderSnapshot = z.infer<typeof providerSnapshotSchema>;
