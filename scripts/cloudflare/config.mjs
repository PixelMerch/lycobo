import path from "node:path";
export const accountId = "9a65fad90669d9c27b58d856ab3ce410";
export function deploymentSettings(env) {
  if ((env.CLOUDFLARE_ACCOUNT_ID ?? accountId) !== accountId)
    throw new Error("Cloudflare account must match the reviewed lycobo account.");
  const hyperdrive = env.CLOUDFLARE_HYPERDRIVE_ID;
  if (!hyperdrive || !/^[a-f0-9]{32}$/.test(hyperdrive) || /^0+$/.test(hyperdrive))
    throw new Error(
      "Set CLOUDFLARE_HYPERDRIVE_ID after provisioning Hyperdrive with query caching disabled.",
    );
  const project = env.SUPABASE_PROJECT_REF;
  if (!project || !/^[a-z]{20}$/.test(project))
    throw new Error("Set SUPABASE_PROJECT_REF to the reviewed database project.");
  return { accountId, hyperdrive, databaseHost: `db.${project}.supabase.co` };
}
export function releaseConfig(base, settings, root) {
  const config = structuredClone(base);
  config.main = path.resolve(root, config.main);
  config.tsconfig = path.resolve(root, "tsconfig.json");
  config.hyperdrive = [{ binding: "HYPERDRIVE", id: settings.hyperdrive }];
  // Runtime values belong to Cloudflare; even local defaults must not override them.
  delete config.vars;
  config.keep_vars = true;
  return config;
}
