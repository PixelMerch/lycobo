import { randomUUID } from "node:crypto";
import { openCloudBaseImageRepository } from "@lycoboai/db";
import { readImagePolicy, standaloneModels } from "@lycoboai/generation";
import { cloudbaseObjectBucket } from "@lycoboai/storage/cloudbase";
import { objectImageStore } from "@lycoboai/storage/object-images";
import { processImageItem } from "./image-processor";

/** Event/timer invocation owns the whole execution; no paid work in API handlers. */
export async function main() {
  const policy = readImagePolicy({
    IMAGE_GENERATION_ENABLED: process.env.IMAGE_GENERATION_ENABLED,
  });
  if (!policy.enabled) return { enabled: false, processed: 0 };
  if (process.env.DATABASE_URL) throw new Error("DATABASE_BACKEND_CONFLICT");
  const independent = await standaloneModels(process.env);
  if (!independent) throw new Error("CLOUDBASE_STANDALONE_MODELS_REQUIRED");
  const repository = openCloudBaseImageRepository(process.env, independent);
  const store = objectImageStore(cloudbaseObjectBucket(process.env), repository.storageUid);
  let processed = 0;
  const stopStartingAt = Date.now() + 7 * 60 * 1000;
  try {
    await repository.expireClaims();
    await repository.pruneEvents();
    for (const asset of await repository.expiredReferences()) {
      try {
        await store.remove(asset);
        await repository.markReferenceDeleted(asset.id);
      } catch {
        console.error("REFERENCE_CLEANUP_FAILED", asset.id);
      }
    }
    const leased = await repository.leaseOutbox();
    for (let index = 0; index < leased.length; index += 2) {
      // Leave unstarted intents durable; their leases expire for a later invocation.
      if (Date.now() >= stopStartingAt) break;
      await Promise.all(
        leased.slice(index, index + 2).map(async (entry) => {
          await processImageItem(entry.itemId, {
            repository,
            store,
            workerId: `cloudbase:${randomUUID()}`,
            modelSecret: process.env.MODEL_CREDENTIAL_SECRET,
            standaloneKey: process.env.STANDALONE_IMAGE_API_KEY,
            overrides: policy.overrides,
            editsEnabled: policy.editsEnabled,
          });
          await repository.ackOutbox(entry.id, entry.leaseToken);
          processed++;
        }),
      );
    }
    return { enabled: true, processed };
  } finally {
    await repository.close();
  }
}
