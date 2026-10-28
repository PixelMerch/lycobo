import { openImageRepository } from "@lycoboai/db";
import { readImagePolicy } from "@lycoboai/generation";
import { dispatchImageOutbox, type ImageQueueSender } from "@lycoboai/queue";
import { r2ImageStore } from "@lycoboai/storage/r2";
import { imageObjectBucket, type S3Bindings } from "@lycoboai/storage/s3";
import { processImageItem } from "../src/image-processor";
import { consumeImageMessages } from "../src/queue-consumer";

export interface GenerationBindings extends S3Bindings {
  HYPERDRIVE: Hyperdrive;
  IMAGES_BUCKET: R2Bucket;
  IMAGES: ImagesBinding;
  GENERATION_QUEUE: ImageQueueSender;
  MODEL_CREDENTIAL_SECRET?: string;
  IMAGE_GENERATION_ENABLED?: string;
}
export async function processGenerationBatch(
  batch: Pick<MessageBatch<{ version: 1; itemId: string }>, "messages">,
  env: GenerationBindings,
) {
  const policy = readImagePolicy({
    IMAGE_GENERATION_ENABLED: env.IMAGE_GENERATION_ENABLED,
  });
  if (!policy.enabled) throw new Error("GENERATION_NOT_CONFIGURED");
  const bucket = imageObjectBucket(env, env.IMAGES_BUCKET);
  const repository = openImageRepository(env.HYPERDRIVE.connectionString, true);
  const store = r2ImageStore(bucket, env.IMAGES, repository.storageUid);
  try {
    await consumeImageMessages(batch, (itemId, deliveryId) =>
      processImageItem(itemId, {
        repository,
        store,
        modelSecret: env.MODEL_CREDENTIAL_SECRET,
        workerId: `cloudflare:${deliveryId}`,
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
