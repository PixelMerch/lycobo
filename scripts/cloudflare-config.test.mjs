import { describe, expect, it } from "vitest";
import { accountId, deploymentSettings, releaseConfig } from "./cloudflare/config.mjs";

const env = {
  CLOUDFLARE_ACCOUNT_ID: accountId,
  CLOUDFLARE_HYPERDRIVE_ID: "a".repeat(32),
  AUTH_JWT_SECRET: "fixture-only-".repeat(4),
  CLOUDFLARE_PUBLIC_ORIGIN: "https://lycobo.pages.dev",
};
describe("Cloudflare deployment boundaries", () => {
  it("rejects missing resource identifiers, another account and unsafe browser origins", () => {
    for (const overrides of [
      { CLOUDFLARE_ACCOUNT_ID: "b".repeat(32) },
      { CLOUDFLARE_HYPERDRIVE_ID: "0".repeat(32) },
      { AUTH_JWT_SECRET: "short" },
      { CLOUDFLARE_PUBLIC_ORIGIN: "http://localhost:5173" },
      { CLOUDFLARE_PUBLIC_ORIGIN: "https://lycobo.pages.dev/path" },
    ])
      expect(() => deploymentSettings({ ...env, ...overrides })).toThrow();
  });
  it("does not enable paid processing without a provider key", () => {
    expect(() => deploymentSettings({ ...env, IMAGE_GENERATION_ENABLED: "true" })).toThrow();
    expect(deploymentSettings(env).enabled).toBe(false);
  });
  it("keeps secrets out of generated bindings and limits login to the production origin", () => {
    const settings = deploymentSettings(env);
    const base = { name: "lycobo-api", main: "cloudflare/index.ts", hyperdrive: [], vars: {} };
    const config = releaseConfig(base, settings, "/fixture/apps/api");
    expect(config.main).toBe("/fixture/apps/api/cloudflare/index.ts");
    expect(config.vars.AUTH_TRUSTED_ORIGINS).toBe("https://lycobo.pages.dev");
    expect(config.hyperdrive).toEqual([
      { binding: "HYPERDRIVE", id: env.CLOUDFLARE_HYPERDRIVE_ID },
    ]);
    expect(JSON.stringify(config)).not.toContain(env.AUTH_JWT_SECRET);
    expect(base.hyperdrive).toEqual([]);
  });
});
