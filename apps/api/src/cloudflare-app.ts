import { creemBillingProvider, drainGenerationCredits } from "@lycoboai/billing";
import { openAuthRepository, openRealtimeRepository } from "@lycoboai/db";
import { supportedResolutions, validateModelInput } from "@lycoboai/generation";
import { dispatchImageOutbox, dispatchRealtime } from "@lycoboai/queue";
import { assetDeliverySigner } from "@lycoboai/storage/delivery";
import { openCloudflareRuntime } from "../../worker/src/cloudflare/cloudflare-runtime";
import { createApp } from "./app";
import { closeAfterStream } from "./cloudflare-response";
import { enterpriseAuth, readAuthConfig } from "./features/auth/service";
import { creemWebhookRoutes } from "./features/billing/creem-webhook";
import { checkoutService } from "./features/billing/service";
import { externalWalletService } from "./features/billing/wallet-service";
import { readWebhookConfig } from "./features/images/webhooks/provider-webhook";
import { createCreemModerator } from "./features/moderation/creem-moderation";

type OptionalBindings = {
  SUPABASE_AUTH_PUBLISHABLE_KEY?: string;
  SUPABASE_EMAIL_TURNSTILE_SITE_KEY?: string;
  CREEM_API_KEY?: string;
  CREEM_WEBHOOK_SECRET?: string;
  BILLING_PRODUCTS?: string;
  BILLING_OFFER_END_AT?: string;
};

function activeBilling(env: CloudflareEnv & OptionalBindings, trustedOrigin: string | undefined) {
  const mode = String(env.BILLING_PROVIDER ?? "local");
  if (mode === "local") return;
  const key = env.CREEM_API_KEY?.trim();
  if (
    mode !== "creem" ||
    !key?.startsWith("creem_") ||
    key.startsWith("creem_test_") ||
    !env.CREEM_WEBHOOK_SECRET ||
    !trustedOrigin ||
    env.CREEM_MODERATION_ENABLED !== "true"
  )
    throw new Error("BILLING_CONFIGURATION_REQUIRED");
  return { provider: creemBillingProvider(key), successUrl: new URL("/", trustedOrigin).href };
}

function cloudflareBilling(
  env: CloudflareEnv & OptionalBindings,
  repository: Awaited<ReturnType<typeof openCloudflareRuntime>>["repository"],
  trustedOrigin: string | undefined,
) {
  const configured = activeBilling(env, trustedOrigin);
  const checkout =
    configured &&
    checkoutService(repository, configured.provider, {
      products: env.BILLING_PRODUCTS,
      offerEnd: env.BILLING_OFFER_END_AT,
      successUrl: configured.successUrl,
    });
  const billingWebhooks = env.CREEM_WEBHOOK_SECRET
    ? creemWebhookRoutes(
        env.CREEM_WEBHOOK_SECRET,
        repository,
        env.CREEM_API_KEY?.trim().startsWith("creem_test_") ? "creem-test" : "creem",
      )
    : undefined;
  let jobId: string | undefined;
  return {
    dependencies: {
      billing: configured && externalWalletService(repository, configured.provider),
      moderate: createCreemModerator(env),
      checkout,
      billingWebhooks,
      wakeBilling: async (id: string) => {
        jobId = id;
      },
    },
    async flush() {
      if (!configured || !jobId) return;
      try {
        const deferred = await drainGenerationCredits(configured.provider, repository, jobId);
        if (deferred) console.error("BILLING_SETTLEMENT_DEFERRED");
        await dispatchImageOutbox(repository, env.IMAGE_QUEUE);
      } catch {
        // 已接受任务的账务意图可由独立 Worker 恢复。
        console.error("BILLING_SETTLEMENT_DEFERRED");
      }
    },
  };
}

/** 为每次请求组装 Hono API、鉴权和 Webhook 验签依赖。 */
export async function serveCloudflareApi(
  request: Request,
  env: CloudflareEnv & OptionalBindings,
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
      SUPABASE_AUTH_URL: env.SUPABASE_AUTH_URL,
      SUPABASE_AUTH_PROVIDERS: env.SUPABASE_AUTH_PROVIDERS,
      SUPABASE_AUTH_PUBLISHABLE_KEY: env.SUPABASE_AUTH_PUBLISHABLE_KEY,
      SUPABASE_EMAIL_TURNSTILE_SITE_KEY: env.SUPABASE_EMAIL_TURNSTILE_SITE_KEY,
      AUTH_PASSWORD_TURNSTILE_SITE_KEY: env.AUTH_PASSWORD_TURNSTILE_SITE_KEY,
      AUTH_PASSWORD_TURNSTILE_SECRET: env.AUTH_PASSWORD_TURNSTILE_SECRET,
    });
    if (!authConfig) throw new Error("AUTH_CONFIGURATION_REQUIRED");
    const auth = enterpriseAuth(authRepository, {
      ...authConfig,
      edgeClientAddress: request.headers.get("CF-Connecting-IP"),
    });
    const webhook = readWebhookConfig(env);
    if (env.IMAGE_WEBHOOK_ENABLED === "true" && !webhook)
      throw new Error("WEBHOOK_CONFIGURATION_REQUIRED");
    const { policy, repository, store, uploads } = runtime;
    const billingRuntime = cloudflareBilling(env, repository, auth.config.origins[0]);
    const app = createApp(
      (event) => console.error(event),
      {
        repository,
        ...billingRuntime.dependencies,
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
      background(deliverAndClose(request, realtime, env, close, billingRuntime.flush));
      streaming = true;
    } else {
      await billingRuntime.flush();
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
  // OAuth 回跳虽是 GET，但成功时会签发会话并写入旧会话的退出通知。
  const isOAuthCallback =
    request.method === "GET" && new URL(request.url).pathname === "/api/v1/auth/oauth/callback";
  if (!isOAuthCallback && ["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
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
  settle: () => Promise<void>,
) {
  try {
    await settle();
    await deliverRealtime(request, realtime, env);
  } finally {
    await close();
  }
}
