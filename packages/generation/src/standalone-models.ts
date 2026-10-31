import {
  type ImageGenerationInput,
  imageResolutionSchema,
  providerSnapshotSchema,
} from "@lycoboai/contracts";

/** 主站试用配置；不读取管理后台表。密钥仅由服务端运行环境注入。 */
export interface StandaloneModelEnvironment {
  STANDALONE_MODELS?: string;
  STANDALONE_IMAGE_API_KEY?: string;
  STANDALONE_PLANNER_API_KEY?: string;
  MODEL_CREDENTIAL_SECRET?: string;
}
export const standaloneCredentialId = "8fd01c10-fb8c-4ed0-bdab-000000000001";
const channelId = "8fd01c10-fb8c-4ed0-bdab-000000000002";
const models = [
  { id: "gpt-image-2", upstream: "gpt-image-2", adapter: "fluxport-images" },
  { id: "gpt-image-2.5", upstream: "gpt-image-2.5-sunburst", adapter: "fluxport-images" },
  { id: "nano-banana-2.1", upstream: "gemini-3.1-flash-image-preview", adapter: "gemini-native" },
  {
    id: "gemini-3-pro-image-preview",
    upstream: "gemini-3-pro-image-preview",
    adapter: "gemini-native",
  },
  { id: "grok-imagine-image-2.0", upstream: "grok-imagine-image-2.0", adapter: "fluxport-images" },
  { id: "seedream-5.0-pro", upstream: "seedream-5.0-pro", adapter: "fluxport-images" },
] as const;
export async function standaloneModels(env: StandaloneModelEnvironment) {
  if (env.STANDALONE_MODELS !== "true") return undefined;
  if (!env.STANDALONE_IMAGE_API_KEY || !env.STANDALONE_PLANNER_API_KEY)
    throw new Error("STANDALONE_MODEL_SECRETS_REQUIRED");
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
        taskTimeoutSeconds: 1800,
        downloadOrigins: [],
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
      origin: "https://api.uselg.top/",
      model: "claude-sonnet-5",
      protocol: "anthropic-messages" as const,
      timeoutMs: 60000,
      ciphertext: "standalone-env",
    },
    capabilities: () =>
      Object.fromEntries(
        ["create", "textile-set", "local-edit"].map((tool) => [
          tool,
          models.map(({ id }) => ({
            id,
            managed: true,
            enabledResolutions: imageResolutionSchema.options,
            editsEnabled: true,
            maxReferences: 6,
          })),
        ]),
      ),
    resolve: (input: ImageGenerationInput) => {
      const snapshot = snapshots[input.model];
      if (!snapshot || input.referenceAssetIds.length > snapshot.maxReferences)
        throw new Error("MODEL_CHANNEL_DISABLED");
      return snapshot;
    },
  };
}
