import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

export function localEnvironment(source, docker = false, settings = source) {
  const env = Object.fromEntries(
    Object.entries(source).filter(
      ([key]) =>
        !/^(CLOUDBASE_|TCB_|TENCENTCLOUD_|CLOUDFLARE_|CF_|SUPABASE_|AUTH_|ASSET_|VAKV_|IMAGE_|MODEL_|WRANGLER_|S3_|STANDALONE_|LOCAL_|DEEPSEEK_|DATABASE_URL)/.test(
          key,
        ),
    ),
  );
  env.DATABASE_URL = `postgresql://lycoboai:local_dev_only@${docker ? "postgres:5432" : "127.0.0.1:55432"}/lycoboai`;
  if (
    settings.IMAGE_GENERATION_ENABLED !== undefined &&
    !["true", "false"].includes(settings.IMAGE_GENERATION_ENABLED)
  )
    throw new Error("INVALID_GENERATION_FLAG");
  env.IMAGE_GENERATION_ENABLED = String(settings.IMAGE_GENERATION_ENABLED === "true");
  if (env.IMAGE_GENERATION_ENABLED === "true") {
    if (!settings.MODEL_CREDENTIAL_SECRET) throw new Error("MODEL_CREDENTIAL_SECRET_REQUIRED");
    for (const key of [
      "MODEL_CREDENTIAL_SECRET",
      "STANDALONE_MODELS",
      "STANDALONE_IMAGE_API_KEY",
      "DEEPSEEK_API_KEY",
    ])
      if (settings[key]) env[key] = settings[key];
  }
  Object.assign(env, {
    APP_ENV: "development",
    NODE_ENV: "development",
    API_HOST: docker ? "0.0.0.0" : "127.0.0.1",
    API_PORT: "8787",
    IMAGE_DATA_DIR: resolve(".local/images"),
    S3_ENDPOINT: docker ? "http://image-storage:8333" : "http://127.0.0.1:9004",
    S3_BUCKET: "generated-images",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY_ID: "local-image-dev",
    S3_SECRET_ACCESS_KEY: "local-image-dev-only",
    AUTH_JWT_SECRET: randomBytes(48).toString("base64url"),
    AUTH_TRUSTED_ORIGINS:
      "http://localhost:8081,http://127.0.0.1:8081,http://localhost:5173,http://127.0.0.1:5173,http://localhost:8787,http://127.0.0.1:8787",
    ASSET_SIGNING_SECRET: randomBytes(32).toString("hex"),
    ASSET_PUBLIC_ORIGIN: "http://127.0.0.1:8791",
    ASSET_ALLOWED_ORIGINS:
      "http://localhost:8081,http://127.0.0.1:8081,http://localhost:5173,http://127.0.0.1:5173,http://localhost:8787,http://127.0.0.1:8787",
  });
  return env;
}
