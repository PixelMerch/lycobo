import { openImageRepository } from "@lycoboai/db";
import {
  readImagePolicy,
  type StandaloneModelEnvironment,
  standaloneModels,
} from "@lycoboai/generation";
import { dispatchImageOutbox, type ImageQueueSender } from "@lycoboai/queue";
import { r2ImageStore } from "@lycoboai/storage/r2";
import { imageObjectBucket, type S3Bindings } from "@lycoboai/storage/s3";
import { processImageItem } from "../src/image-processor";
import { consumeImageMessages } from "../src/queue-consumer";

export interface GenerationBindings extends S3Bindings, StandaloneModelEnvironment {
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
  const repository = openImageRepository(
    env.HYPERDRIVE.connectionString,
    true,
    await standaloneModels(env),
  );
  const store = r2ImageStore(bucket, env.IMAGES, repository.storageUid);
  try {
    await consumeImageMessages(batch, (itemId, deliveryId) =>
      processImageItem(itemId, {
        repository,
        store,
        modelSecret: env.MODEL_CREDENTIAL_SECRET,
        standaloneKey: env.STANDALONE_MODELS === "true" ? env.STANDALONE_IMAGE_API_KEY : undefined,
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
    const repository = openImageRepository(
      env.HYPERDRIVE.connectionString,
      true,
      await standaloneModels(env),
    );
    try {
      await repository.expireClaims();
      await repository.pruneEvents();
      const store = r2ImageStore(
        imageObjectBucket(env, env.IMAGES_BUCKET),
        env.IMAGES,
        repository.storageUid,
      );
      for (const asset of await repository.expiredReferences()) {
        try {
          await store.remove(asset);
          await repository.markReferenceDeleted(asset.id);
        } catch {
          // Leave the expired row pending so the next scheduled run retries deletion.
          console.error("REFERENCE_CLEANUP_FAILED", asset.id);
        }
      }
      if (env.IMAGE_GENERATION_ENABLED !== "true") return;
      // Always drain durable intents, including when a prior HTTP transport send failed.
      for (let page = 0; page < 5; page++)
        if ((await dispatchImageOutbox(repository, env.GENERATION_QUEUE)) < 20) break;
    } finally {
      await repository.close();
    }
  },
} satisfies ExportedHandler<GenerationBindings, { version: 1; itemId: string }>;
