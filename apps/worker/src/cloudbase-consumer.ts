import { randomUUID } from "node:crypto";
import { openCloudBaseImageRepository, openVideoRepository } from "@lycoboai/db";
import { readImagePolicy, standaloneModels, videoConfiguration } from "@lycoboai/generation";
import {
  cloudbaseImageReferenceSigner,
  cloudbaseObjectBucket,
  cloudbaseProviderReferenceSigner,
} from "@lycoboai/storage/cloudbase";
import { objectImageStore } from "@lycoboai/storage/object-images";
import { z } from "zod";
import { cloudbaseImageReferences } from "./cloudbase-image-references";
import { drainCloudBaseOutbox } from "./cloudbase-outbox";
import { startAsyncDrain } from "./cloudbase-wake";
import { processImageItem } from "./image-processor";
import { slots } from "./slots";
import { processVideoIntent } from "./video-processor";

const imageScope = z.literal("images").optional();
const wakeEvent = z.object({ wake: z.literal(true), scope: imageScope });
const drainEvent = z.object({
  drain: z.literal(true),
  resumeAt: z.number().int().optional(),
  scope: imageScope,
});

async function drainVideos(
  videos: ReturnType<typeof openVideoRepository>,
  videoConfig: NonNullable<ReturnType<typeof videoConfiguration>>,
  stopStartingAt: number,
) {
  for (let count = 0; count < 4 && Date.now() < stopStartingAt; count++) {
    if (
      !(await processVideoIntent(videos, cloudbaseObjectBucket(process.env), {
        ...videoConfig,
        assetOrigin: process.env.ASSET_PUBLIC_ORIGIN ?? "",
        signingSecret: process.env.ASSET_SIGNING_SECRET ?? "",
        referenceUrl: cloudbaseProviderReferenceSigner(process.env),
        pathPrefix: process.env.ASSET_PATH_PREFIX,
      }))
    )
      break;
  }
  const due = await videos.run("due");
  if (
    typeof due === "string" &&
    !(await startAsyncDrain(process.env, {
      drain: true,
      resumeAt: Math.min(Date.now() + 60000, Math.max(Date.now() + 5000, Date.parse(due))),
    }))
  )
    console.error("VIDEO_CONTINUATION_FAILED");
}

async function pruneImageData(
  repository: ReturnType<typeof openCloudBaseImageRepository>,
  store: ReturnType<typeof objectImageStore>,
) {
  await repository.pruneEvents();
  await repository.pruneWebhooks();
  for (const asset of await repository.expiredReferences()) {
    try {
      await store.remove(asset);
      await repository.markReferenceDeleted(asset.id);
    } catch {
      console.error("REFERENCE_CLEANUP_FAILED", asset.id);
    }
  }
}

/** Event/timer invocation owns the whole execution; no paid work in API handlers. */
export async function main(event?: unknown) {
  const policy = readImagePolicy({});
  // The API wakes this function synchronously. That call only queues an asynchronous drain,
  // so paid work never runs inside an invocation whose caller may disconnect.
  const wake = wakeEvent.safeParse(event);
  if (wake.success)
    return {
      enabled: true,
      processed: 0,
      woken: await startAsyncDrain(process.env, { drain: true, scope: wake.data.scope }),
    };
  if (process.env.DATABASE_URL) throw new Error("DATABASE_BACKEND_CONFLICT");
  const independent = await standaloneModels(process.env);
  if (!independent) throw new Error("CLOUDBASE_STANDALONE_MODELS_REQUIRED");
  const repository = openCloudBaseImageRepository(process.env, independent);
  const bucket = cloudbaseObjectBucket(process.env);
  const objects = objectImageStore(bucket, repository.storageUid);
  const deliverReference = cloudbaseImageReferences(
    bucket,
    objects,
    cloudbaseImageReferenceSigner(process.env),
  );
  // Image persistence is the memory-heavy step (a 4K original alone needs about 200 MB of the
  // 512 MB function), so at most two items decode and encode at once however many are in flight.
  const encode = slots(2);
  const store: typeof objects = {
    ...objects,
    put: (...args) => encode(() => objects.put(...args)),
  };
  const drain = drainEvent.safeParse(event);
  const scope = drain.data?.scope;
  const videoConfig = scope === "images" ? null : videoConfiguration(process.env);
  // A continuation waits for the deferred work it was queued for (at most a provider poll delay).
  if (drain.success && drain.data.resumeAt)
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(90000, Math.max(0, (drain.data.resumeAt ?? 0) - Date.now()))),
    );
  const stopStartingAt = Date.now() + 7 * 60 * 1000;
  const videos = videoConfig ? openVideoRepository(process.env) : undefined;
  try {
    if (videos && videoConfig) {
      await drainVideos(videos, videoConfig, stopStartingAt);
    }
    await repository.expireClaims();
    // Retention and expired-reference cleanup are not urgent: timer and manual runs keep them current.
    if (!drain.success) {
      await pruneImageData(repository, store);
    }
    const { processed, resumeAt } = await drainCloudBaseOutbox({
      repository,
      stopStartingAt,
      process: (itemId, onDeferred, onWebhookAccepted) =>
        processImageItem(itemId, {
          repository,
          store,
          workerId: `cloudbase:${randomUUID()}`,
          modelSecret: process.env.MODEL_CREDENTIAL_SECRET,
          standaloneKey: process.env.STANDALONE_IMAGE_API_KEY,
          overrides: policy.overrides,
          editsEnabled: policy.editsEnabled,
          deliverReference,
          requireMainImageReferenceUrls: true,
          onTiming: (timing) => console.info("Image generation stage timing", timing),
          onDeferred,
          onWebhookAccepted,
        }),
    });
    // Continue work left behind now instead of at the next timer run; the timer stays the fallback.
    if (
      resumeAt !== null &&
      !(await startAsyncDrain(process.env, { drain: true, resumeAt, scope }))
    )
      console.error("CONSUMER_CONTINUATION_FAILED");
    return { enabled: true, processed };
  } finally {
    await Promise.all([repository.close(), videos?.close()]);
  }
}
