import { openImageRepository } from "@lycoboai/db";
import { readImagePolicy } from "@lycoboai/generation";
import { dispatchImageOutbox, type ImageQueueSender } from "@lycoboai/queue";
import { r2ImageStore } from "@lycoboai/storage/r2";
import { processImageItem } from "../src/image-processor";
import { consumeImageMessages } from "../src/queue-consumer";

export interface GenerationBindings {
  HYPERDRIVE: Hyperdrive;
  IMAGES_BUCKET: R2Bucket;
  IMAGES: ImagesBinding;
  GENERATION_QUEUE: ImageQueueSender;
  VAKV_API_KEY: string;
  MODEL_CREDENTIAL_SECRET?: string;
  VAKV_BASE_URL?: string;
  GENERATION_TIMEOUT_MS?: string;
  IMAGE_GENERATION_ENABLED?: string;
  VAKV_ENABLE_IMAGE_EDITS?: string;
  VAKV_CAPABILITY_OVERRIDES?: string;
}
export async function processGenerationBatch(
  batch: Pick<MessageBatch<{ version: 1; itemId: string }>, "messages">,
  env: GenerationBindings,
) {
  const policy = readImagePolicy({
    IMAGE_GENERATION_ENABLED: env.IMAGE_GENERATION_ENABLED,
    VAKV_ENABLE_IMAGE_EDITS: env.VAKV_ENABLE_IMAGE_EDITS,
    VAKV_CAPABILITY_OVERRIDES: env.VAKV_CAPABILITY_OVERRIDES,
  });
  if (!policy.enabled) throw new Error("GENERATION_NOT_CONFIGURED");
  const timeoutMs = Number(env.GENERATION_TIMEOUT_MS ?? 600000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 600000)
    throw new Error("INVALID_GENERATION_TIMEOUT");
  // Configured tasks own their origin and credentials. Legacy settings are validated
  // only by the legacy adapter after a task has been claimed.
  const baseUrl = env.VAKV_BASE_URL || "https://api.vakv.cn";
  const repository = openImageRepository(env.HYPERDRIVE.connectionString, true);
  const store = r2ImageStore(env.IMAGES_BUCKET, env.IMAGES, repository.storageUid);
  try {
    await consumeImageMessages(batch, (itemId, deliveryId) =>
      processImageItem(itemId, {
        repository,
        store,
        modelSecret: env.MODEL_CREDENTIAL_SECRET,
        workerId: `cloudflare:${deliveryId}`,
        provider: {
          key: env.VAKV_API_KEY,
          baseUrl,
          timeoutMs,
          onTiming: (event) => console.info({ itemId, ...event }),
        },
        request: (input, init) => fetch(input, init),
        overrides: policy.overrides,
        editsEnabled: policy.editsEnabled,
      }),
    );
  } finally {
    await repository.close();
  }
}
export default {
  queue: processGenerationBatch,
  async scheduled(_event, env) {
    const repository = openImageRepository(env.HYPERDRIVE.connectionString, true);
    try {
      await repository.expireClaims();
      await repository.pruneEvents();
      if (env.IMAGE_GENERATION_ENABLED !== "true") return;
      // Always drain durable intents, including when a prior HTTP transport send failed.
      for (let page = 0; page < 5; page++)
        if ((await dispatchImageOutbox(repository, env.GENERATION_QUEUE)) < 20) break;
    } finally {
      await repository.close();
    }
  },
} satisfies ExportedHandler<GenerationBindings, { version: 1; itemId: string }>;
