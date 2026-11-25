import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

// 只继承进程工具所需的设置，避免未来增加的供应商密钥进入本地子进程。
const processKeys = new Set([
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "TMPDIR",
  "TMP",
  "TEMP",
  "SystemRoot",
  "SYSTEMROOT",
  "WINDIR",
  "COMSPEC",
  "PATHEXT",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TERM",
  "COLORTERM",
  "NO_COLOR",
  "FORCE_COLOR",
  "TZ",
  "LOG_LEVEL",
  "NODE_OPTIONS",
  "NODE_EXTRA_CA_CERTS",
  "NODE_USE_ENV_PROXY",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
  "no_proxy",
  "CI",
  "GITHUB_ACTIONS",
  "PNPM_HOME",
  "NPM_CONFIG_USERCONFIG",
  "npm_config_userconfig",
  "npm_config_cache",
  "XDG_CACHE_HOME",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
]);

/** 为隔离开发组装固定基础设施，仅显式导入模型与进程工具配置。 */
export function localEnvironment(source, docker = false, settings = source) {
  const env = Object.fromEntries(
    Object.entries(source).filter(([key]) => processKeys.has(key) || key.startsWith("DEV_")),
  );
  env.DATABASE_URL = `postgresql://lycoboai:local_dev_only@${docker ? "postgres:5432" : "127.0.0.1:55432"}/lycoboai`;
  if (settings.MODEL_CREDENTIAL_SECRET) {
    for (const key of [
      "MODEL_CREDENTIAL_SECRET",
      "STANDALONE_MODELS",
      "STANDALONE_IMAGE_API_KEY",
      "DEEPSEEK_API_KEY",
    ])
      if (settings[key]) env[key] = settings[key];
  }
  for (const key of [
    "DEV_SUPABASE_AUTH_URL",
    "DEV_SUPABASE_AUTH_PUBLISHABLE_KEY",
    "DEV_SUPABASE_AUTH_PROVIDERS",
    "DEV_SUPABASE_EMAIL_TURNSTILE_SITE_KEY",
    "DEV_AUTH_PASSWORD_TURNSTILE_SITE_KEY",
    "DEV_AUTH_PASSWORD_TURNSTILE_SECRET",
  ]) {
    if (settings[key]) env[key] = settings[key];
  }
  if (settings.VIDEO_REFERENCE_ORIGIN) env.VIDEO_REFERENCE_ORIGIN = settings.VIDEO_REFERENCE_ORIGIN;
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
