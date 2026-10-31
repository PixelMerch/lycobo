import { businessCodes } from "@lycoboai/contracts";
import { openAuthRepository, openImageEventFeed, openImageRepository } from "@lycoboai/db";
import {
  readImagePolicy,
  type StandaloneModelEnvironment,
  standaloneModels,
  supportedResolutions,
  validateModelInput,
} from "@lycoboai/generation";
import { dispatchImageOutbox, type ImageQueueSender } from "@lycoboai/queue";
import { assetDeliverySigner } from "@lycoboai/storage/delivery";
import { r2ImageStore } from "@lycoboai/storage/r2";
import { imageObjectBucket, type S3Bindings } from "@lycoboai/storage/s3";
import { createApp } from "../src/app";
import { enterpriseAuth, readAuthConfig } from "../src/features/auth/service";

export interface ApiBindings extends S3Bindings, StandaloneModelEnvironment {
  ASSET_SIGNING_SECRET?: string;
  ASSET_PUBLIC_ORIGIN?: string;
  HYPERDRIVE: Hyperdrive;
  IMAGES_BUCKET: R2Bucket;
  IMAGES: ImagesBinding;
  GENERATION_QUEUE: ImageQueueSender;
  APP_ENV?: string;
  AUTH_JWT_SECRET: string;
  AUTH_TRUSTED_ORIGINS: string;
  IMAGE_GENERATION_ENABLED?: string;
  MODEL_CREDENTIAL_SECRET?: string;
}
function unavailable(code: "AUTH_NOT_CONFIGURED" | "INTERNAL_ERROR") {
  const requestId = crypto.randomUUID();
  return Response.json(
    {
      request_id: requestId,
      code: businessCodes[code],
      message: code === "AUTH_NOT_CONFIGURED" ? "登录服务尚未配置" : "服务暂时不可用",
      data: {},
      error: { code },
    },
    { status: 503, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
  );
}
async function dispatch(env: ApiBindings) {
  const repository = openImageRepository(
    env.HYPERDRIVE.connectionString,
    true,
    await standaloneModels(env),
  );
  try {
    await dispatchImageOutbox(repository, env.GENERATION_QUEUE);
  } catch {
    console.error("OUTBOX_DISPATCH_UNAVAILABLE");
  } finally {
    await repository.close();
  }
}
/** Keep request-scoped pools alive until a streamed response ends or is cancelled. */
function cleanupResponse(response: Response, close: () => Promise<void>, ctx: ExecutionContext) {
  if (!response.body) {
    ctx.waitUntil(close());
    return response;
  }
  const reader = response.body.getReader();
  let closed = false;
  const finish = () => {
    if (!closed) {
      closed = true;
      ctx.waitUntil(close());
    }
  };
  return new Response(
    new ReadableStream({
      async pull(controller) {
        try {
          const next = await reader.read();
          if (next.done) {
            controller.close();
            finish();
          } else controller.enqueue(next.value);
        } catch {
          controller.error(new Error("RESPONSE_STREAM_UNAVAILABLE"));
          finish();
        }
      },
      async cancel(reason) {
        try {
          await reader.cancel(reason);
        } finally {
          finish();
        }
      },
    }),
    response,
  );
}
async function handleRequest(
  request: Request,
  env: ApiBindings,
  ctx: ExecutionContext,
): Promise<Response> {
  const authConfig = readAuthConfig({
    NODE_ENV: env.APP_ENV === "development" ? "development" : "production",
    AUTH_JWT_SECRET: env.AUTH_JWT_SECRET,
    AUTH_TRUSTED_ORIGINS: env.AUTH_TRUSTED_ORIGINS,
  });
  if (!authConfig) return unavailable("AUTH_NOT_CONFIGURED");
  const bucket = imageObjectBucket(env, env.IMAGES_BUCKET);
  const repository = openImageRepository(
    env.HYPERDRIVE.connectionString,
    true,
    await standaloneModels(env),
  );
  const authRepository = openAuthRepository(env.HYPERDRIVE.connectionString, true);
  const auth = enterpriseAuth(authRepository, authConfig);
  const policy = readImagePolicy({
    IMAGE_GENERATION_ENABLED: env.IMAGE_GENERATION_ENABLED,
  });
  const store = r2ImageStore(bucket, env.IMAGES, repository.storageUid);
  let events = openImageEventFeed(env.HYPERDRIVE.connectionString, "unused");
  const close = () =>
    Promise.all([repository.close(), authRepository.close(), events.close()]).then(() => {});
  try {
    // Workers use durable-event polling, not a process-wide LISTEN socket.
    // The stream remains tenant scoped and reauthorizes through existing auth routes.
    if (new URL(request.url).pathname === "/api/v1/image-events") {
      const token =
        request.headers.get("Authorization")?.replace(/^Bearer /, "") ??
        request.headers
          .get("Cookie")
          ?.split(";")
          .map((part) => part.trim())
          .find((part) => part.startsWith("lycobo_enterprise_session="))
          ?.slice("lycobo_enterprise_session=".length);
      const identity = token ? await auth.authenticate(token) : null;
      if (identity)
        events = openImageEventFeed(env.HYPERDRIVE.connectionString, identity.user.organizationId);
    }
    const app = createApp(
      () => console.error("API_REQUEST_FAILED"),
      {
        repository,
        modelSecret: env.MODEL_CREDENTIAL_SECRET,
        plannerKey: env.STANDALONE_MODELS === "true" ? env.STANDALONE_PLANNER_API_KEY : undefined,
        store,
        signAsset:
          env.ASSET_PUBLIC_ORIGIN && env.ASSET_SIGNING_SECRET
            ? assetDeliverySigner(env.ASSET_PUBLIC_ORIGIN, env.ASSET_SIGNING_SECRET, {
                allowLocalHttp: env.APP_ENV === "development",
              })
            : undefined,
        events,
        auth,
        enabled: policy.enabled,
        managedModelsOnly: true,
        unitCredits: policy.unitCredits,
        editsEnabled: policy.editsEnabled,
        validate: (input) => validateModelInput(input, policy.overrides, policy.editsEnabled),
        resolutions: (model) => supportedResolutions(model, policy.overrides),
      },
      auth,
    );
    const response = await app.fetch(request);
    if (
      request.method === "POST" &&
      response.status === 202 &&
      /\/image-tasks(?:\/|$)/.test(new URL(request.url).pathname)
    )
      ctx.waitUntil(dispatch(env));
    return cleanupResponse(response, close, ctx);
  } catch {
    await close();
    return unavailable("INTERNAL_ERROR");
  }
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env, ctx);
    } catch {
      return unavailable("INTERNAL_ERROR");
    }
  },
} satisfies ExportedHandler<ApiBindings>;
