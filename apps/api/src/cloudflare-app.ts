import { openAuthRepository, openRealtimeRepository } from "@lycoboai/db";
import { supportedResolutions, validateModelInput } from "@lycoboai/generation";
import { dispatchImageOutbox, dispatchRealtime } from "@lycoboai/queue";
import { assetDeliverySigner } from "@lycoboai/storage/delivery";
import { openCloudflareRuntime } from "../../worker/src/cloudflare/cloudflare-runtime";
import { createApp } from "./app";
import { closeAfterStream } from "./cloudflare-response";
import { enterpriseAuth, readAuthConfig } from "./features/auth/service";
import { readWebhookConfig } from "./features/images/webhooks/provider-webhook";

/** 为每次请求组装 Hono API、鉴权和 Webhook 验签依赖。 */
export async function serveCloudflareApi(
  request: Request,
  env: CloudflareEnv,
  background?: (work: Promise<void>) => void,
) {
  if (new URL(request.url).pathname === "/api/health/live") return createApp().fetch(request);
  const runtime = await openCloudflareRuntime(env);
  const authRepository = openAuthRepository(env.HYPERDRIVE.connectionString, true);
  const realtime = openRealtimeRepository(env.HYPERDRIVE.connectionString);
  let streaming = false;
  const close = async () => {
    await Promise.all([authRepository.close(), runtime.repository.close(), realtime.close()]);
  };
  try {
    const authConfig = readAuthConfig({
      AUTH_JWT_SECRET: env.AUTH_JWT_SECRET,
      AUTH_TRUSTED_ORIGINS: env.AUTH_TRUSTED_ORIGINS,
    });
    if (!authConfig) throw new Error("AUTH_CONFIGURATION_REQUIRED");
    const auth = enterpriseAuth(authRepository, authConfig);
    const webhook = readWebhookConfig(env);
    if (env.IMAGE_WEBHOOK_ENABLED === "true" && !webhook)
      throw new Error("WEBHOOK_CONFIGURATION_REQUIRED");
    const { policy, repository, store, uploads } = runtime;
    const app = createApp(
      (event) => console.error(event),
      {
        repository,
        store,
        uploads,
        uploadsEnabled: env.CLOUDFLARE_CONSUMER_ENABLED === "true",
        auth,
        // 提示词优化与规划也会收费，必须受同一个生成开关约束。
        standaloneKey:
          env.CLOUDFLARE_GENERATION_ENABLED === "true" ? env.STANDALONE_IMAGE_API_KEY : undefined,
        plannerKey: env.CLOUDFLARE_GENERATION_ENABLED === "true" ? env.DEEPSEEK_API_KEY : undefined,
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
          if (
            env.CLOUDFLARE_CONSUMER_ENABLED !== "true" ||
            env.CLOUDFLARE_GENERATION_ENABLED !== "true"
          )
            return;
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
      webhook,
      undefined,
      { repository: realtime, hubs: env.REALTIME, auth },
    );
    const response = await app.fetch(request);
    if (response.body && response.headers.get("Content-Type")?.includes("text/event-stream")) {
      const deferred = closeAfterStream(response, async () => {
        try {
          await dispatchRealtime(realtime, env.REALTIME);
        } catch {
          console.error("REALTIME_DISPATCH_FAILED");
        }
        await close();
      });
      streaming = true;
      return deferred;
    }
    // 业务已落库，消息投递不阻塞响应；连接随受管任务结束关闭，失败仍有 outbox 恢复。
    if (background) {
      background(deliverAndClose(request, realtime, env, close));
      streaming = true;
    } else {
      await deliverRealtime(request, realtime, env);
    }
    return response;
  } finally {
    if (!streaming) await close();
  }
}

async function deliverRealtime(
  request: Request,
  realtime: ReturnType<typeof openRealtimeRepository>,
  env: CloudflareEnv,
) {
  if (["GET", "HEAD"].includes(request.method)) return;
  try {
    await dispatchRealtime(realtime, env.REALTIME);
  } catch {
    console.error("REALTIME_DISPATCH_FAILED");
  }
}

async function deliverAndClose(
  request: Request,
  realtime: ReturnType<typeof openRealtimeRepository>,
  env: CloudflareEnv,
  close: () => Promise<void>,
) {
  try {
    await deliverRealtime(request, realtime, env);
  } finally {
    await close();
  }
}
