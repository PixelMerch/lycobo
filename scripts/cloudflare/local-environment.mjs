import { randomBytes } from "node:crypto";

/** Business infrastructure is always local; only explicitly enabled model settings may be imported. */
export function localEnvironment(source, docker = false, modelSettings = source) {
  const env = Object.fromEntries(
    Object.entries(source).filter(
      ([key]) =>
        !/^(?:CLOUDFLARE_|CF_|SUPABASE_|AUTH_|ASSET_|VAKV_|IMAGE_|WRANGLER_)/.test(key) &&
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
  for (const key of ["IMAGE_GENERATION_ENABLED", "VAKV_ENABLE_IMAGE_EDITS"]) {
    if (modelSettings[key] !== undefined && !["true", "false"].includes(modelSettings[key]))
      throw new Error(`${key} must be true or false.`);
  }
  const enabled = modelSettings.IMAGE_GENERATION_ENABLED === "true";
  env.LOCAL_IMAGE_GENERATION_ENABLED = String(enabled);
  env.VAKV_ENABLE_IMAGE_EDITS = String(enabled && modelSettings.VAKV_ENABLE_IMAGE_EDITS === "true");
  if (enabled) {
    if (!modelSettings.VAKV_API_KEY?.trim())
      throw new Error("Enabled local generation requires VAKV_API_KEY in .env.");
    for (const key of [
      "VAKV_API_KEY",
      "VAKV_BASE_URL",
      "VAKV_CAPABILITY_OVERRIDES",
      "GENERATION_TIMEOUT_MS",
    ])
      if (modelSettings[key]) env[key] = modelSettings[key];
  }
  env.WRANGLER_SEND_METRICS = "false";
  env.LOCAL_REDIS_URL = docker ? "redis://redis:6379" : "redis://127.0.0.1:56379";
  env.LOCAL_QUEUE_TOKEN = randomBytes(32).toString("hex");
  return env;
}
