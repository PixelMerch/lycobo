import { openAuthRepository } from "@lycoboai/db";
import { supportedResolutions, validateModelInput } from "@lycoboai/generation";
import { dispatchImageOutbox } from "@lycoboai/queue";
import { assetDeliverySigner } from "@lycoboai/storage/delivery";
import { openCloudflareRuntime } from "../../worker/src/cloudflare-runtime";
import { createApp } from "./app";
import { enterpriseAuth, readAuthConfig } from "./features/auth/service";

export async function serveCloudflareApi(request: Request, env: CloudflareEnv) {
  if (new URL(request.url).pathname === "/api/health/live") return createApp().fetch(request);
  const runtime = await openCloudflareRuntime(env);
  const authRepository = openAuthRepository(env.HYPERDRIVE.connectionString, true);
  try {
    const authConfig = readAuthConfig({
      AUTH_JWT_SECRET: env.AUTH_JWT_SECRET,
      AUTH_TRUSTED_ORIGINS: env.AUTH_TRUSTED_ORIGINS,
    });
    if (!authConfig) throw new Error("AUTH_CONFIGURATION_REQUIRED");
    const auth = enterpriseAuth(authRepository, authConfig);
    const { policy, repository, store, uploads } = runtime;
    const app = createApp(
      (event) => console.error(event),
      {
        repository,
        store,
        uploads,
        uploadsEnabled: env.CLOUDFLARE_CONSUMER_ENABLED === "true",
        auth,
        standaloneKey: env.STANDALONE_IMAGE_API_KEY,
        plannerKey: env.DEEPSEEK_API_KEY,
        signAsset: assetDeliverySigner(env.ASSET_PUBLIC_ORIGIN, env.ASSET_SIGNING_SECRET, {
          pathPrefix: env.ASSET_PATH_PREFIX,
        }),
        enabled:
          env.CLOUDFLARE_GENERATION_ENABLED === "true" &&
          env.CLOUDFLARE_CONSUMER_ENABLED === "true",
        managedModelsOnly: true,
        unitCredits: policy.unitCredits,
        editsEnabled: policy.editsEnabled,
        wake: async () => {
          if (env.CLOUDFLARE_CONSUMER_ENABLED !== "true") return;
          try {
            await dispatchImageOutbox(repository, env.IMAGE_QUEUE);
          } catch {
            console.error("IMAGE_OUTBOX_DISPATCH_FAILED");
          }
        },
        validate: (input) => validateModelInput(input, policy.overrides, policy.editsEnabled),
        resolutions: (model) => supportedResolutions(model, policy.overrides),
      },
      auth,
    );
    return await app.fetch(request);
  } finally {
    await Promise.all([authRepository.close(), runtime.repository.close()]);
  }
}
