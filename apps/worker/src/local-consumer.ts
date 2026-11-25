import { randomUUID } from "node:crypto";
import { creemBillingProvider, settleGenerationCredits } from "@lycoboai/billing";
import { openImageRepository } from "@lycoboai/db";
import { readImagePolicy, standaloneModels } from "@lycoboai/generation";
import { objectImageStore } from "@lycoboai/storage/object-images";
import { imageObjectBucket } from "@lycoboai/storage/s3";
import { processImageItem } from "./images/image-processor";
import { drainImageOutbox } from "./queue/outbox-drain";
import { slots } from "./queue/slots";

const url = new URL(process.env.DATABASE_URL ?? "");
if (!["127.0.0.1", "localhost", "postgres"].includes(url.hostname))
  throw new Error("LOCAL_DATABASE_REQUIRED");
const repository = openImageRepository(url.href, false, await standaloneModels(process.env));
const objects = objectImageStore(imageObjectBucket(process.env), repository.storageUid);
const encode = slots(2);
const store: typeof objects = { ...objects, put: (...args) => encode(() => objects.put(...args)) };
const policy = readImagePolicy(process.env);
const creemTestKey = process.env.CREEM_API_KEY?.trim();
const billingProvider = creemTestKey?.startsWith("creem_test_")
  ? creemBillingProvider(creemTestKey)
  : undefined;
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    stopping = true;
  });
try {
  while (!stopping) {
    if (policy.enabled)
      try {
        await repository.expireClaims();
        if (billingProvider) await settleGenerationCredits(billingProvider, repository);
        await drainImageOutbox({
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
  await repository.close();
}
