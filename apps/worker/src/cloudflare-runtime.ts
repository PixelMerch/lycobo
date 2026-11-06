import { openImageRepository } from "@lycoboai/db";
import { readImagePolicy, standaloneModels } from "@lycoboai/generation";
import { cloudflareImageStore, r2ObjectBucket } from "@lycoboai/storage/cloudflare";
import { providerReferenceSigner } from "@lycoboai/storage/delivery";
import { cloudflareUploads } from "@lycoboai/storage/uploads";
import { z } from "zod";

const tasksSinceSchema = z
  .string()
  .datetime()
  .transform((value) => new Date(value));

/** Invocation-scoped clients: Hyperdrive owns pooling; no I/O crosses Worker requests. */
export async function openCloudflareRuntime(env: CloudflareEnv) {
  const tasksSince = tasksSinceSchema.parse(env.CLOUDFLARE_TASKS_SINCE);
  if (
    (env.CLOUDFLARE_CONSUMER_ENABLED === "true" || env.CLOUDFLARE_GENERATION_ENABLED === "true") &&
    tasksSince.getTime() > Date.now()
  )
    throw new Error("CLOUDFLARE_CUTOVER_REQUIRED");
  const independent = await standaloneModels(env);
  if (!independent) throw new Error("STANDALONE_MODELS_REQUIRED");
  const repository = openImageRepository(
    env.HYPERDRIVE.connectionString,
    true,
    independent,
    tasksSince,
  );
  const bucket = r2ObjectBucket(env.MEDIA);
  const store = cloudflareImageStore(bucket, env.IMAGES, repository.storageUid);
  const uploads = cloudflareUploads(bucket, env.IMAGE_QUEUE, repository, store);
  const signReference = providerReferenceSigner(
    env.ASSET_PUBLIC_ORIGIN,
    env.ASSET_SIGNING_SECRET,
    env.ASSET_PATH_PREFIX,
  );
  return {
    repository,
    bucket,
    store,
    uploads,
    policy: readImagePolicy({}),
    // Reference PNGs are already bounded and stripped; local edits preserve their bytes.
    deliverReference: async (asset: { objectKey: string }) =>
      new URL(await signReference(asset.objectKey)),
  };
}
