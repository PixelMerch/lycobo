import { randomBytes } from "node:crypto";

/** Business infrastructure is always local; only explicitly enabled model settings may be imported. */
export function localEnvironment(source, docker = false, modelSettings = source) {
  const env = Object.fromEntries(
    Object.entries(source).filter(
      ([key]) =>
        !/^(?:CLOUDBASE_|TCB_|TENCENTCLOUD_|CLOUDFLARE_|CF_|SUPABASE_|AUTH_|ASSET_|VAKV_|IMAGE_|MODEL_|WRANGLER_|S3_|STANDALONE_)/.test(
          key,
        ) &&
        key !== "DATABASE_URL" &&
        key !== "LOCAL_IMAGE_GENERATION_ENABLED" &&
        !key.startsWith("LOCAL_QUEUE_") &&
        key !== "LOCAL_REDIS_URL",
    ),
  );
  env.DATABASE_URL = docker
    ? "postgresql://lycoboai:local_dev_only@postgres:5432/lycoboai"
    : "postgresql://lycoboai:local_dev_only@127.0.0.1:55432/lycoboai";
  env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE = env.DATABASE_URL;
  if (
    modelSettings.IMAGE_GENERATION_ENABLED !== undefined &&
    !["true", "false"].includes(modelSettings.IMAGE_GENERATION_ENABLED)
  )
    throw new Error("IMAGE_GENERATION_ENABLED must be true or false");
  env.LOCAL_IMAGE_GENERATION_ENABLED = String(modelSettings.IMAGE_GENERATION_ENABLED === "true");
  if (modelSettings.MODEL_CREDENTIAL_SECRET)
    env.MODEL_CREDENTIAL_SECRET = modelSettings.MODEL_CREDENTIAL_SECRET;
  if (env.LOCAL_IMAGE_GENERATION_ENABLED === "true" && !env.MODEL_CREDENTIAL_SECRET)
    throw new Error(
      "Enabled local generation requires MODEL_CREDENTIAL_SECRET and backend channels.",
    );
  if (env.LOCAL_IMAGE_GENERATION_ENABLED === "true" && modelSettings.STANDALONE_MODELS === "true") {
    for (const key of ["STANDALONE_MODELS", "STANDALONE_IMAGE_API_KEY", "DEEPSEEK_API_KEY"])
      if (modelSettings[key]) env[key] = modelSettings[key];
  }
  if (docker)
    Object.assign(env, {
      S3_ENDPOINT: "http://image-storage:8333",
      S3_BUCKET: "generated-images",
      S3_REGION: "us-east-1",
      S3_ACCESS_KEY_ID: "local-image-dev",
      S3_SECRET_ACCESS_KEY: "local-image-dev-only",
    });
  env.WRANGLER_SEND_METRICS = "false";
  env.LOCAL_REDIS_URL = docker ? "redis://redis:6379" : "redis://127.0.0.1:56379";
  env.LOCAL_QUEUE_TOKEN = randomBytes(32).toString("hex");
  env.ASSET_SIGNING_SECRET = randomBytes(32).toString("hex");
  env.ASSET_PUBLIC_ORIGIN = "http://cdn.lycobo.localhost:8791";
  env.ASSET_ALLOWED_ORIGINS =
    "http://localhost:8081,http://127.0.0.1:8081,http://localhost:5173,http://127.0.0.1:5173,http://localhost:8787,http://127.0.0.1:8787";
  return env;
}
