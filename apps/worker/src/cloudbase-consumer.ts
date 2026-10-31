import { randomUUID } from "node:crypto";
import { openCloudBaseImageRepository } from "@lycoboai/db";
import { readImagePolicy, standaloneModels } from "@lycoboai/generation";
import { cloudbaseObjectBucket } from "@lycoboai/storage/cloudbase";
import { objectImageStore } from "@lycoboai/storage/object-images";
import { z } from "zod";
import { drainCloudBaseOutbox } from "./cloudbase-outbox";
import { startAsyncDrain } from "./cloudbase-wake";
import { processImageItem } from "./image-processor";

const wakeEvent = z.object({ wake: z.literal(true) });
const drainEvent = z.object({ drain: z.literal(true), resumeAt: z.number().int().optional() });

/** Event/timer invocation owns the whole execution; no paid work in API handlers. */
export async function main(event?: unknown) {
  const policy = readImagePolicy({
    IMAGE_GENERATION_ENABLED: process.env.IMAGE_GENERATION_ENABLED,
  });
  if (!policy.enabled) return { enabled: false, processed: 0 };
  // The API wakes this function synchronously. That call only queues an asynchronous drain,
  // so paid work never runs inside an invocation whose caller may disconnect.
  if (wakeEvent.safeParse(event).success)
    return {
      enabled: true,
      processed: 0,
      woken: await startAsyncDrain(process.env, { drain: true }),
    };
  if (process.env.DATABASE_URL) throw new Error("DATABASE_BACKEND_CONFLICT");
  const independent = await standaloneModels(process.env);
  if (!independent) throw new Error("CLOUDBASE_STANDALONE_MODELS_REQUIRED");
  const repository = openCloudBaseImageRepository(process.env, independent);
  const store = objectImageStore(cloudbaseObjectBucket(process.env), repository.storageUid);
  const drain = drainEvent.safeParse(event);
  // A continuation waits for the deferred work it was queued for (at most a provider poll delay).
  if (drain.success && drain.data.resumeAt)
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(90000, Math.max(0, (drain.data.resumeAt ?? 0) - Date.now()))),
    );
  const stopStartingAt = Date.now() + 7 * 60 * 1000;
  try {
    await repository.expireClaims();
    // Retention and expired-reference cleanup are not urgent: timer and manual runs keep them current.
    if (!drain.success) {
      await repository.pruneEvents();
      for (const asset of await repository.expiredReferences()) {
        try {
          await store.remove(asset);
          await repository.markReferenceDeleted(asset.id);
        } catch {
          console.error("REFERENCE_CLEANUP_FAILED", asset.id);
        }
      }
    }
    const { processed, resumeAt } = await drainCloudBaseOutbox({
      repository,
      stopStartingAt,
      process: (itemId, onDeferred) =>
        processImageItem(itemId, {
          repository,
          store,
          workerId: `cloudbase:${randomUUID()}`,
          modelSecret: process.env.MODEL_CREDENTIAL_SECRET,
          standaloneKey: process.env.STANDALONE_IMAGE_API_KEY,
          overrides: policy.overrides,
          editsEnabled: policy.editsEnabled,
          onDeferred,
        }),
    });
    // Continue work left behind now instead of at the next timer run; the timer stays the fallback.
    if (resumeAt !== null && !(await startAsyncDrain(process.env, { drain: true, resumeAt })))
      console.error("CONSUMER_CONTINUATION_FAILED");
    return { enabled: true, processed };
  } finally {
    await repository.close();
  }
}
