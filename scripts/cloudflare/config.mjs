import path from "node:path";
export const accountId = "9a65fad90669d9c27b58d856ab3ce410";
export function deploymentSettings(env) {
  if ((env.CLOUDFLARE_ACCOUNT_ID ?? accountId) !== accountId)
    throw new Error("Cloudflare account must match the reviewed lycobo account.");
  const origin = new URL(env.CLOUDFLARE_PUBLIC_ORIGIN || "https://lycobo.pages.dev");
  if (
    origin.protocol !== "https:" ||
    origin.origin !== origin.href.replace(/\/$/, "") ||
    origin.username ||
    origin.password
  )
    throw new Error("CLOUDFLARE_PUBLIC_ORIGIN must be an exact HTTPS origin.");
  const hyperdrive = env.CLOUDFLARE_HYPERDRIVE_ID;
  if (!hyperdrive || !/^[a-f0-9]{32}$/.test(hyperdrive) || /^0+$/.test(hyperdrive))
    throw new Error(
      "Set CLOUDFLARE_HYPERDRIVE_ID after provisioning Hyperdrive with query caching disabled.",
    );
  if (!env.AUTH_JWT_SECRET || Buffer.byteLength(env.AUTH_JWT_SECRET) < 32)
    throw new Error("AUTH_JWT_SECRET requires at least 32 bytes.");
  const enabled = env.IMAGE_GENERATION_ENABLED === "true";
  const editsEnabled = env.VAKV_ENABLE_IMAGE_EDITS === "true";
  const provider = new URL(env.VAKV_BASE_URL || "https://api.vakv.cn");
  if (
    provider.protocol !== "https:" ||
    provider.username ||
    provider.password ||
    provider.pathname !== "/" ||
    provider.search ||
    provider.hash
  )
    throw new Error("Provider must be an exact HTTPS origin.");
  const timeoutMs = Number(env.GENERATION_TIMEOUT_MS ?? 300000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 600000)
    throw new Error("Generation timeout must be 1000–600000 ms.");
  if (enabled && !env.VAKV_API_KEY) throw new Error("Enabled generation requires VAKV_API_KEY.");
  return {
    accountId,
    origin: origin.origin,
    hyperdrive,
    enabled,
    editsEnabled,
    providerOrigin: provider.origin,
    timeoutMs,
  };
}
export function releaseConfig(base, settings, root) {
  const config = structuredClone(base);
  config.main = path.resolve(root, config.main);
  config.tsconfig = path.resolve(root, "tsconfig.json");
  config.hyperdrive = [{ binding: "HYPERDRIVE", id: settings.hyperdrive }];
  config.vars = { ...config.vars, IMAGE_GENERATION_ENABLED: String(settings.enabled) };
  config.vars.VAKV_ENABLE_IMAGE_EDITS = String(settings.editsEnabled);
  if (config.name === "lycobo-generation") {
    config.vars.VAKV_BASE_URL = settings.providerOrigin;
    config.vars.GENERATION_TIMEOUT_MS = String(settings.timeoutMs);
  }
  if (config.name === "lycobo-api") config.vars.AUTH_TRUSTED_ORIGINS = settings.origin;
  return config;
}
