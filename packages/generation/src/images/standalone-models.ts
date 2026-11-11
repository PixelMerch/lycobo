import { createHash } from "node:crypto";
import {
  type ImageGenerationInput,
  imageResolutionSchema,
  mainImageModelIds,
  providerSnapshotSchema,
} from "@lycoboai/contracts";

/** 主站试用配置；不读取管理后台表。密钥仅由服务端运行环境注入。 */
export interface StandaloneModelEnvironment {
  STANDALONE_MODELS?: string;
  IMAGE_WEBHOOK_ENABLED?: string;
  STANDALONE_IMAGE_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  MODEL_CREDENTIAL_SECRET?: string;
}
export const standaloneCredentialId = "8fd01c10-fb8c-4ed0-bdab-000000000001";
const channelId = "8fd01c10-fb8c-4ed0-bdab-000000000002";
const models = [
  { id: "gpt-image-2.6", upstream: "gpt-image-2.6", adapter: "fluxport-images" },
  { id: "gpt-image-2", upstream: "gpt-image-2", adapter: "fluxport-images" },
  { id: "gpt-image-2.5", upstream: "gpt-image-2.5-sunburst", adapter: "fluxport-images" },
  { id: "nano-banana-2.1", upstream: "gemini-3.1-flash-image-preview", adapter: "gemini-native" },
  {
    id: "gemini-3-pro-image-preview",
    upstream: "gemini-3-pro-image-preview",
    adapter: "gemini-native",
  },
] as const;
/** 从环境密钥组装主站渠道，主图制作只开放指定的三个型号。 */
export async function standaloneModels(env: StandaloneModelEnvironment) {
  if (env.STANDALONE_MODELS !== "true") return undefined;
  if (!env.STANDALONE_IMAGE_API_KEY || !env.DEEPSEEK_API_KEY)
    throw new Error("STANDALONE_MODEL_SECRETS_REQUIRED");
  const imageKey = env.STANDALONE_IMAGE_API_KEY;
  const credentialCipher = "standalone-env";
  const snapshots = Object.fromEntries(
    models.map((model) => [
      model.id,
      providerSnapshotSchema.parse({
        model: model.id,
        upstreamModel: model.upstream,
        origin: "https://api.ai-media.vip/",
        adapter: model.adapter,
        mode: model.adapter === "gemini-native" ? "sync" : "async-preferred",
        resolutions: imageResolutionSchema.options,
        editsEnabled: true,
        maxReferences: 6,
        timeoutMs: 60000,
        taskTimeoutSeconds: env.IMAGE_WEBHOOK_ENABLED === "true" ? 600 : 180,
        ...(env.IMAGE_WEBHOOK_ENABLED === "true"
          ? {
              webhook: {
                source: imageWebhookSource(imageKey),
                waitSeconds: 60,
              },
            }
          : {}),
        downloadOrigins: ["https://download.ai-media.vip"],
        channelId,
        credentialId: standaloneCredentialId,
      }),
    ]),
  );
  return {
    snapshots,
    credentialCipher,
    credentialId: standaloneCredentialId,
    planner: {
      origin: "https://api.deepseek.com/",
      model: "deepseek-flash",
      protocol: "openai-chat" as const,
      timeoutMs: 60000,
      ciphertext: "standalone-env",
    },
    capabilities: () =>
      Object.fromEntries(
        ["create", "textile-set", "local-edit", "replica"].map((tool) => [
          tool,
          modelsForTool(tool).map(({ id }) => ({
            id,
            managed: true,
            enabledResolutions: imageResolutionSchema.options,
            editsEnabled: true,
            maxReferences: tool === "replica" ? 11 : 6,
          })),
        ]),
      ),
    resolve: (input: ImageGenerationInput) => {
      // 专用工具共用上游渠道，旧任务的公开型号仍可用于幂等确认和重试。
      const usesCommerceChannel = !!(input.replica || input.textileSet || input.variation);
      const snapshot = snapshots[usesCommerceChannel ? "gpt-image-2.6" : input.model];
      if (
        !snapshot ||
        input.referenceAssetIds.length > (input.replica ? 11 : snapshot.maxReferences)
      )
        throw new Error("MODEL_CHANNEL_DISABLED");
      return usesCommerceChannel
        ? { ...snapshot, upstreamModel: "gpt-image-2.6-sunburst" }
        : snapshot;
    },
  };
}

/** Key-scoped routing identifier; never expose the generation credential. */
export function imageWebhookSource(key: string) {
  return createHash("sha256").update(`fluxport:${key}`).digest("hex");
}

/** 按工具公布可用能力，家纺裂变保留旧型号以支持历史记录与滚动发布。 */
function modelsForTool(tool: string) {
  if (tool === "replica") return [{ id: "gpt-image-2.6" }];
  if (tool === "create") return mainImageModelIds.map((id) => ({ id }));
  if (tool === "textile-set") return models;
  return models.filter((model) => model.id !== "gpt-image-2.6");
}
