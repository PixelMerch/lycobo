import { isAbsolute } from "node:path";
import { serve } from "@hono/node-server";
import {
  openAuthRepository,
  openCloudBaseAuthRepository,
  openCloudBaseImageEventFeed,
  openCloudBaseImageRepository,
  openImageEventFeed,
  openImageRepository,
  openVideoRepository,
  readCloudBaseDatabaseConfig,
} from "@lycoboai/db";
import {
  readImagePolicy,
  standaloneModels,
  supportedResolutions,
  validateModelInput,
  videoConfiguration,
} from "@lycoboai/generation";
import { imageStore } from "@lycoboai/storage";
import { cloudbaseObjectBucket, readCloudBaseStorageConfig } from "@lycoboai/storage/cloudbase";
import { assetDeliverySigner, videoReferenceOrigin } from "@lycoboai/storage/delivery";
import { objectImageStore } from "@lycoboai/storage/object-images";
import { imageObjectBucket } from "@lycoboai/storage/s3";
import pino from "pino";
import { createApp } from "./app";
import { readEnv } from "./env";
import { enterpriseAuth, readAuthConfig } from "./features/auth/service";
import { cloudbaseConsumerWake } from "./features/images/consumer-wake";
import { readWebhookConfig } from "./features/images/provider-webhook";
import { readWorkbenchSession } from "./features/images/session";
import { videoService } from "./features/videos/service";

const env = readEnv(process.env);
const logger = pino({ level: env.LOG_LEVEL });
const policy = readImagePolicy({});
const cloudbaseStorage = readCloudBaseStorageConfig(process.env);
const cloudbaseDatabase = readCloudBaseDatabaseConfig(process.env);
if (policy.enabled && !cloudbaseStorage && !isAbsolute(process.env.IMAGE_DATA_DIR ?? ""))
  throw new Error("IMAGE_DATA_DIR must be an absolute shared directory");
if (cloudbaseDatabase && process.env.DATABASE_URL) throw new Error("DATABASE_BACKEND_CONFLICT");
const independent = await standaloneModels(process.env);
if (cloudbaseDatabase && !independent) throw new Error("CLOUDBASE_STANDALONE_MODELS_REQUIRED");
const databaseUrl = process.env.DATABASE_URL;
function openImageBackend() {
  if (cloudbaseDatabase && independent)
    return openCloudBaseImageRepository(cloudbaseDatabase, independent);
  return databaseUrl ? openImageRepository(databaseUrl, false, independent) : null;
}
const repository = openImageBackend();
if (policy.enabled && !repository) throw new Error("DATABASE_URL is required for the Image API");
const authConfig = readAuthConfig(process.env);
if (authConfig && !databaseUrl && !cloudbaseDatabase)
  throw new Error("Enterprise auth database is required");
function openAuthBackend() {
  if (!authConfig) return null;
  if (cloudbaseDatabase) return openCloudBaseAuthRepository(cloudbaseDatabase);
  return databaseUrl ? openAuthRepository(databaseUrl) : null;
}
const authRepository = openAuthBackend();
const auth = authRepository && authConfig ? enterpriseAuth(authRepository, authConfig) : undefined;
// CloudBase bills a held SSE response as function time, and its feed polls keep the shared
// PostgreSQL instance metered; browsers poll unfinished tasks instead unless explicitly enabled.
function openEventBackend() {
  const enabled = process.env.IMAGE_EVENTS_ENABLED;
  if (!repository || enabled === "false") return undefined;
  if (cloudbaseDatabase)
    return enabled === "true" ? openCloudBaseImageEventFeed(cloudbaseDatabase) : undefined;
  return databaseUrl ? openImageEventFeed(databaseUrl) : undefined;
}
const events = openEventBackend();
const wakeConsumer = cloudbaseDatabase
  ? cloudbaseConsumerWake(
      cloudbaseDatabase,
      process.env.CLOUDBASE_CONSUMER_FUNCTION ?? "lycobo-consumer",
    )
  : undefined;
function openImageStore() {
  const storageUid = repository?.storageUid;
  if (cloudbaseStorage)
    return objectImageStore(cloudbaseObjectBucket(cloudbaseStorage), storageUid);
  if (process.env.S3_ENDPOINT) return objectImageStore(imageObjectBucket(process.env), storageUid);
  return imageStore(process.env.IMAGE_DATA_DIR ?? "./data/images", storageUid);
}
const store = openImageStore();
if (policy.enabled) await store.ready();
const videoConfig = videoConfiguration(process.env);
const videoRepository = videoConfig ? openVideoRepository(process.env) : undefined;
const signAsset =
  process.env.ASSET_PUBLIC_ORIGIN && process.env.ASSET_SIGNING_SECRET
    ? assetDeliverySigner(process.env.ASSET_PUBLIC_ORIGIN, process.env.ASSET_SIGNING_SECRET, {
        pathPrefix: process.env.ASSET_PATH_PREFIX ?? "/",
        allowLocalHttp: process.env.APP_ENV === "development",
      })
    : undefined;
const videoReady = !!(
  videoConfig &&
  signAsset &&
  auth &&
  (cloudbaseStorage || process.env.S3_ENDPOINT)
);
const app = createApp(
  (event) => logger.error(event, "Request failed"),
  repository
    ? {
        repository,
        modelSecret: process.env.MODEL_CREDENTIAL_SECRET,
        standaloneKey:
          process.env.STANDALONE_MODELS === "true"
            ? process.env.STANDALONE_IMAGE_API_KEY
            : undefined,
        plannerKey:
          process.env.STANDALONE_MODELS === "true" ? process.env.DEEPSEEK_API_KEY : undefined,
        events,
        wake:
          wakeConsumer &&
          (async () => {
            if (!(await wakeConsumer("images")))
              logger.warn({ code: "CONSUMER_WAKE_FAILED" }, "Consumer wake failed");
          }),
        store,
        signAsset,
        enabled: policy.enabled,
        managedModelsOnly: true,
        unitCredits: policy.unitCredits,
        editsEnabled: policy.editsEnabled,
        session: auth ? undefined : readWorkbenchSession(process.env),
        auth,
        validate: (input) => validateModelInput(input, policy.overrides, policy.editsEnabled),
        resolutions: (model) => supportedResolutions(model, policy.overrides),
      }
    : undefined,
  auth,
  readWebhookConfig(process.env),
  videoReady && videoConfig && videoRepository && signAsset
    ? {
        service: videoService({
          repository: videoRepository,
          ...videoConfig,
          sign: signAsset,
          referencesReady: !!(cloudbaseStorage || videoReferenceOrigin(process.env)),
          wake: wakeConsumer
            ? async () => {
                await wakeConsumer();
              }
            : undefined,
        }),
      }
    : undefined,
);
const server = serve({ fetch: app.fetch, hostname: env.API_HOST, port: env.API_PORT }, (info) => {
  const host = env.API_HOST === "0.0.0.0" || env.API_HOST === "::" ? "127.0.0.1" : env.API_HOST;
  const url = new URL(`http://localhost:${info.port}/api`);
  url.hostname = host.includes(":") ? `[${host}]` : host;
  if (process.env.NODE_ENV === "development" && process.env.DEV_API_PUBLIC_PORT) {
    url.port = process.env.DEV_API_PUBLIC_PORT;
  }
  logger.info({ host: env.API_HOST, port: info.port, url: url.href }, `API: ${url.href}`);
});
let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  const deadline = setTimeout(() => process.exit(1), 10_000).unref();
  void events?.close();
  server.close(async (error) => {
    try {
      await Promise.all([
        repository?.close(),
        videoRepository?.close(),
        authRepository?.close(),
        events?.close(),
      ]);
      process.exitCode = error ? 1 : 0;
    } catch {
      process.exitCode = 1;
    } finally {
      clearTimeout(deadline);
    }
  });
  if ("closeIdleConnections" in server) server.closeIdleConnections();
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
