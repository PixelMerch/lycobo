import { isAbsolute } from "node:path";
import { serve } from "@hono/node-server";
import {
  openAuthRepository,
  openCloudBaseAuthRepository,
  openCloudBaseImageEventFeed,
  openCloudBaseImageRepository,
  openImageEventFeed,
  openImageRepository,
  readCloudBaseDatabaseConfig,
} from "@lycoboai/db";
import {
  readImagePolicy,
  standaloneModels,
  supportedResolutions,
  validateModelInput,
} from "@lycoboai/generation";
import { imageStore } from "@lycoboai/storage";
import { cloudbaseObjectBucket, readCloudBaseStorageConfig } from "@lycoboai/storage/cloudbase";
import { assetDeliverySigner } from "@lycoboai/storage/delivery";
import { objectImageStore } from "@lycoboai/storage/object-images";
import pino from "pino";
import { createApp } from "./app";
import { readEnv } from "./env";
import { enterpriseAuth, readAuthConfig } from "./features/auth/service";
import { readWorkbenchSession } from "./features/images/session";

const env = readEnv(process.env);
const logger = pino({ level: env.LOG_LEVEL });
const policy = readImagePolicy({ IMAGE_GENERATION_ENABLED: process.env.IMAGE_GENERATION_ENABLED });
const cloudbaseStorage = readCloudBaseStorageConfig(process.env);
const cloudbaseDatabase = readCloudBaseDatabaseConfig(process.env);
if (policy.enabled && !cloudbaseStorage && !isAbsolute(process.env.IMAGE_DATA_DIR ?? ""))
  throw new Error("IMAGE_DATA_DIR must be an absolute shared directory");
if (cloudbaseDatabase && process.env.DATABASE_URL) throw new Error("DATABASE_BACKEND_CONFLICT");
const independent = await standaloneModels(process.env);
if (cloudbaseDatabase && !independent) throw new Error("CLOUDBASE_STANDALONE_MODELS_REQUIRED");
const repository =
  cloudbaseDatabase && independent
    ? openCloudBaseImageRepository(cloudbaseDatabase, independent)
    : process.env.DATABASE_URL
      ? openImageRepository(process.env.DATABASE_URL, false, independent)
      : null;
if (policy.enabled && !repository) throw new Error("DATABASE_URL is required for the Image API");
const authConfig = readAuthConfig(process.env);
if (authConfig && !process.env.DATABASE_URL && !cloudbaseDatabase)
  throw new Error("Enterprise auth database is required");
const authRepository =
  authConfig && cloudbaseDatabase
    ? openCloudBaseAuthRepository(cloudbaseDatabase)
    : authConfig && process.env.DATABASE_URL
      ? openAuthRepository(process.env.DATABASE_URL)
      : null;
const auth = authRepository && authConfig ? enterpriseAuth(authRepository, authConfig) : undefined;
// CloudBase bills a held SSE response as function time, and its feed polls keep the shared
// PostgreSQL instance metered; browsers poll unfinished tasks instead unless explicitly enabled.
const events =
  repository && process.env.IMAGE_EVENTS_ENABLED !== "false"
    ? cloudbaseDatabase
      ? process.env.IMAGE_EVENTS_ENABLED === "true"
        ? openCloudBaseImageEventFeed(cloudbaseDatabase)
        : undefined
      : process.env.DATABASE_URL
        ? openImageEventFeed(process.env.DATABASE_URL)
        : undefined
    : undefined;
const store = cloudbaseStorage
  ? objectImageStore(cloudbaseObjectBucket(cloudbaseStorage), repository?.storageUid)
  : imageStore(process.env.IMAGE_DATA_DIR ?? "./data/images", repository?.storageUid);
if (policy.enabled) await store.ready();
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
        store,
        signAsset:
          process.env.ASSET_PUBLIC_ORIGIN && process.env.ASSET_SIGNING_SECRET
            ? assetDeliverySigner(
                process.env.ASSET_PUBLIC_ORIGIN,
                process.env.ASSET_SIGNING_SECRET,
                {
                  pathPrefix: process.env.ASSET_PATH_PREFIX ?? "/",
                },
              )
            : undefined,
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
      await Promise.all([repository?.close(), authRepository?.close(), events?.close()]);
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
