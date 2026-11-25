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

/** 从生成的绑定类型选取 API 和独立图片消费者共用的运行依赖。 */
export type CloudflareImageEnv = Pick<
  CloudflareEnv,
  | "REALTIME"
  | "MEDIA"
  | "HYPERDRIVE"
  | "IMAGE_QUEUE"
  | "IMAGES"
  | "ASSET_PUBLIC_ORIGIN"
  | "ASSET_PATH_PREFIX"
  | "ASSET_SIGNING_SECRET"
  | "STANDALONE_MODELS"
  | "IMAGE_WEBHOOK_ENABLED"
  | "STANDALONE_IMAGE_API_KEY"
  | "DEEPSEEK_API_KEY"
  | "CLOUDFLARE_CONSUMER_ENABLED"
  | "CLOUDFLARE_GENERATION_ENABLED"
  | "CLOUDFLARE_TASKS_SINCE"
> & { CREEM_API_KEY?: string };

/** 每次调用独立连接 Hyperdrive，结束时关闭客户端，避免跨请求共享 I/O。 */
export async function openCloudflareRuntime(env: CloudflareImageEnv) {
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
    // 参考 PNG 已经限制尺寸并清理元信息，局部编辑直接保留像素。
    deliverReference: async (asset: { objectKey: string }) =>
      new URL(await signReference(asset.objectKey)),
  };
}
