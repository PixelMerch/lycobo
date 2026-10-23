import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { accountId, deploymentSettings, releaseConfig } from "./cloudflare/config.mjs";

const env = {
  CLOUDFLARE_ACCOUNT_ID: accountId,
  CLOUDFLARE_HYPERDRIVE_ID: "a".repeat(32),
  SUPABASE_PROJECT_REF: "wjirihknptxjodgknbfy",
};
describe("Cloudflare deployment boundaries", () => {
  it("rejects missing resource identifiers and another account", () => {
    for (const overrides of [
      { CLOUDFLARE_ACCOUNT_ID: "b".repeat(32) },
      { CLOUDFLARE_HYPERDRIVE_ID: "0".repeat(32) },
      { CLOUDFLARE_HYPERDRIVE_ID: undefined },
      { SUPABASE_PROJECT_REF: undefined },
      { SUPABASE_PROJECT_REF: "invalid" },
    ])
      expect(() => deploymentSettings({ ...env, ...overrides })).toThrow();
  });
  it("validates the database target without requiring runtime secrets", () => {
    expect(deploymentSettings(env).databaseHost).toBe("db.wjirihknptxjodgknbfy.supabase.co");
  });
  it.each(["lycobo-api", "lycobo-generation"])(
    "preserves Cloudflare runtime settings for %s despite local defaults or credentials",
    (name) => {
      const settings = deploymentSettings({
        ...env,
        AUTH_JWT_SECRET: "fixture-secret",
        VAKV_API_KEY: "fixture-key",
        IMAGE_GENERATION_ENABLED: "true",
        VAKV_ENABLE_IMAGE_EDITS: "true",
        SUPABASE_DATABASE_URL: "fixture-database-url",
      });
      const base = {
        name,
        main: "cloudflare/index.ts",
        hyperdrive: [],
        vars: { IMAGE_GENERATION_ENABLED: "false", AUTH_TRUSTED_ORIGINS: "local-only" },
      };
      const config = releaseConfig(base, settings, "/fixture");
      expect(config.main).toBe("/fixture/cloudflare/index.ts");
      expect(config.keep_vars).toBe(true);
      expect(config).not.toHaveProperty("vars");
      expect(config.hyperdrive).toEqual([
        { binding: "HYPERDRIVE", id: env.CLOUDFLARE_HYPERDRIVE_ID },
      ]);
      expect(JSON.stringify(config)).not.toMatch(/fixture-secret|fixture-key|fixture-database-url/);
      expect(base.vars.IMAGE_GENERATION_ENABLED).toBe("false");
      expect(base.hyperdrive).toEqual([]);
    },
  );
  it("does not request runtime settings or upload secrets from the deployment workflow", async () => {
    const workflow = await readFile(".github/workflows/deploy-cloudflare.yml", "utf8");
    expect(workflow).not.toMatch(
      /AUTH_JWT_SECRET|VAKV_API_KEY|SUPABASE_DATABASE_URL|CLOUDFLARE_PUBLIC_ORIGIN|IMAGE_GENERATION_ENABLED|VAKV_ENABLE_IMAGE_EDITS|enable_generation/,
    );
    const deploy = await readFile("scripts/cloudflare/deploy.mjs", "utf8");
    expect(deploy).not.toContain("--secrets-file");
    for (const service of ["api", "worker"]) {
      const config = JSON.parse(await readFile(`apps/${service}/wrangler.jsonc`, "utf8"));
      expect(config.keep_vars).toBe(true);
      expect(config).not.toHaveProperty("vars");
    }
  });
});
