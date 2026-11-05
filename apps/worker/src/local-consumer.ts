import { randomUUID } from "node:crypto";
import { openImageRepository, openVideoRepository } from "@lycoboai/db";
import { readImagePolicy, standaloneModels, videoConfiguration } from "@lycoboai/generation";
import { videoReferenceOrigin } from "@lycoboai/storage/delivery";
import { objectImageStore } from "@lycoboai/storage/object-images";
import { imageObjectBucket } from "@lycoboai/storage/s3";
import { drainCloudBaseOutbox } from "./cloudbase-outbox";
import { processImageItem } from "./image-processor";
import { slots } from "./slots";
import { processVideoIntent } from "./video-processor";

const url = new URL(process.env.DATABASE_URL ?? "");
if (!["127.0.0.1", "localhost", "postgres"].includes(url.hostname))
  throw new Error("LOCAL_DATABASE_REQUIRED");
const repository = openImageRepository(url.href, false, await standaloneModels(process.env));
const objects = objectImageStore(imageObjectBucket(process.env), repository.storageUid);
const encode = slots(2);
const store: typeof objects = { ...objects, put: (...args) => encode(() => objects.put(...args)) };
const policy = readImagePolicy(process.env);
const videoConfig =
  process.env.ASSET_PUBLIC_ORIGIN && process.env.ASSET_SIGNING_SECRET
    ? videoConfiguration(process.env)
    : null;
const referenceOrigin = videoReferenceOrigin(process.env);
const videos = videoConfig ? openVideoRepository(process.env) : undefined;
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    stopping = true;
  });
try {
  while (!stopping) {
    if (videos && videoConfig)
      try {
        if (!process.env.ASSET_PUBLIC_ORIGIN || !process.env.ASSET_SIGNING_SECRET)
          throw new Error("VIDEO_CONFIGURATION_REQUIRED");
        await processVideoIntent(videos, imageObjectBucket(process.env), {
          ...videoConfig,
          assetOrigin: referenceOrigin ?? "",
          signingSecret: process.env.ASSET_SIGNING_SECRET,
          pathPrefix: process.env.ASSET_PATH_PREFIX,
        });
      } catch {
        console.error("VIDEO_CONSUMER_FAILED");
      }
    if (policy.enabled)
      try {
        await repository.expireClaims();
        await drainCloudBaseOutbox({
          repository,
          stopStartingAt: Date.now() + 5000,
          process: (itemId, onDeferred, onWebhookAccepted) =>
            processImageItem(itemId, {
              repository,
              store,
              workerId: `local:${randomUUID()}`,
              modelSecret: process.env.MODEL_CREDENTIAL_SECRET,
              standaloneKey: process.env.STANDALONE_IMAGE_API_KEY,
              requireMainImageReferenceUrls: process.env.STANDALONE_MODELS === "true",
              overrides: policy.overrides,
              editsEnabled: policy.editsEnabled,
              onDeferred,
              onWebhookAccepted,
            }),
        });
      } catch {
        console.error("LOCAL_CONSUMER_FAILED");
      }
    if (!stopping) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
} finally {
  await Promise.all([repository.close(), videos?.close()]);
}
