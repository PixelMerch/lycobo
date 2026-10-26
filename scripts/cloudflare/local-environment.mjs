/** Local development must not inherit production credentials from the shell or .env. */
export function localEnvironment(source, docker = false) {
  const env = Object.fromEntries(
    Object.entries(source).filter(
      ([key]) =>
        !/^(?:CLOUDFLARE_|CF_|SUPABASE_|AUTH_|ASSET_|VAKV_|IMAGE_|WRANGLER_)/.test(key) &&
        key !== "DATABASE_URL" &&
        key !== "LOCAL_IMAGE_GENERATION_ENABLED",
    ),
  );
  env.DATABASE_URL = docker
    ? "postgresql://lycoboai:local_dev_only@postgres:5432/lycoboai"
    : "postgresql://lycoboai:local_dev_only@127.0.0.1:55432/lycoboai";
  env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE = env.DATABASE_URL;
  env.LOCAL_IMAGE_GENERATION_ENABLED = "false";
  env.WRANGLER_SEND_METRICS = "false";
  return env;
}
