import { isAbsolute } from "node:path";
import { serve } from "@hono/node-server";
import { creemBillingProvider } from "@lycoboai/billing";
import {
  openAuthRepository,
  openImageEventFeed,
  openImageRepository,
  openRealtimeRepository,
} from "@lycoboai/db";
import {
  readImagePolicy,
  standaloneModels,
  supportedResolutions,
  validateModelInput,
} from "@lycoboai/generation";
import { imageStore } from "@lycoboai/storage";
import { assetDeliverySigner } from "@lycoboai/storage/delivery";
import { objectImageStore } from "@lycoboai/storage/object-images";
import { imageObjectBucket } from "@lycoboai/storage/s3";
import pino from "pino";
import { createApp } from "./app";
import { readEnv } from "./env";
import { enterpriseAuth, readAuthConfig } from "./features/auth/service";
import { creemWebhookRoutes } from "./features/billing/creem-webhook";
import { checkoutService } from "./features/billing/service";
import { externalWalletService } from "./features/billing/wallet-service";
import { readWorkbenchSession } from "./features/images/session";
import { createCreemModerator } from "./features/moderation/creem-moderation";

// Node 入口只用于隔离开发，生产由 cloudflare.ts 启动。
const env = readEnv(process.env);
const logger = pino({ level: env.LOG_LEVEL });
const url = new URL(process.env.DATABASE_URL ?? "");
if (!["127.0.0.1", "localhost", "postgres"].includes(url.hostname))
  throw new Error("LOCAL_DATABASE_REQUIRED");
const policy = readImagePolicy({});
const repository = openImageRepository(url.href, false, await standaloneModels(process.env));
const realtime = openRealtimeRepository(url.href);
const authConfig = readAuthConfig(process.env);
const authRepository = authConfig ? openAuthRepository(url.href) : undefined;
const auth = authRepository && authConfig ? enterpriseAuth(authRepository, authConfig) : undefined;
const events =
  process.env.IMAGE_EVENTS_ENABLED === "true" ? openImageEventFeed(url.href) : undefined;
const directory = process.env.IMAGE_DATA_DIR ?? "";
if (!process.env.S3_ENDPOINT && !isAbsolute(directory))
  throw new Error("IMAGE_DATA_DIR must be absolute");
const store = process.env.S3_ENDPOINT
  ? objectImageStore(imageObjectBucket({ ...process.env }), repository.storageUid)
  : imageStore(directory, repository.storageUid);
await store.ready();
const signAsset =
  process.env.ASSET_PUBLIC_ORIGIN && process.env.ASSET_SIGNING_SECRET
    ? assetDeliverySigner(process.env.ASSET_PUBLIC_ORIGIN, process.env.ASSET_SIGNING_SECRET, {
        pathPrefix: process.env.ASSET_PATH_PREFIX ?? "/",
        allowLocalHttp: true,
      })
    : undefined;
const creemTestKey = process.env.CREEM_API_KEY?.trim();
const billingProvider = creemTestKey?.startsWith("creem_test_")
  ? creemBillingProvider(creemTestKey)
  : undefined;
const billingEnabled = process.env.BILLING_PROVIDER === "creem";
const billingSecret = process.env.CREEM_WEBHOOK_SECRET;
const siteOrigin = authConfig?.origins[0];
const moderate = billingEnabled ? createCreemModerator(process.env) : undefined;
if (
  billingEnabled &&
  (!billingProvider ||
    !billingSecret ||
    !siteOrigin ||
    !moderate ||
    process.env.CREEM_MODERATION_ENABLED !== "true")
)
  throw new Error("BILLING_TEST_CONFIGURATION_REQUIRED");
const checkout =
  billingEnabled && billingProvider && siteOrigin
    ? checkoutService(repository, billingProvider, {
        products: process.env.BILLING_PRODUCTS,
        offerEnd: process.env.BILLING_OFFER_END_AT,
        successUrl: new URL("/", siteOrigin).href,
      })
    : undefined;
const app = createApp(
  (event) => logger.error(event, "Request failed"),
  {
    repository,
    moderate,
    billing:
      billingEnabled && billingProvider
        ? externalWalletService(repository, billingProvider)
        : undefined,
    checkout,
    billingWebhooks:
      billingProvider && billingSecret
        ? creemWebhookRoutes(billingSecret, repository, billingProvider.id)
        : undefined,
    store,
    auth,
    signAsset,
    events,
    standaloneKey: process.env.STANDALONE_IMAGE_API_KEY,
    plannerKey: process.env.DEEPSEEK_API_KEY,
    enabled: policy.enabled,
    managedModelsOnly: true,
    unitCredits: policy.unitCredits,
    editsEnabled: policy.editsEnabled,
    session: auth ? undefined : readWorkbenchSession(process.env),
    validate: (input) => validateModelInput(input, policy.overrides, policy.editsEnabled),
    resolutions: (model) => supportedResolutions(model, policy.overrides),
  },
  auth,
  undefined,
  undefined,
  { repository: realtime, auth },
);
const server = serve({ fetch: app.fetch, hostname: env.API_HOST, port: env.API_PORT });
let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  server.close(() => {
    void Promise.all([
      repository.close(),
      authRepository?.close(),
      events?.close(),
      realtime.close(),
    ]).catch(() => {
      process.exitCode = 1;
    });
  });
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
