import { describe, expect, it } from "vitest";
import { localEnvironment } from "./local-environment.mjs";

describe("local development isolation", () => {
  const production = {
    PATH: "/usr/bin",
    DATABASE_URL: "postgresql://secret@remote.example/db",
    SUPABASE_DATABASE_URL: "postgresql://secret@remote.example/db",
    CLOUDFLARE_API_TOKEN: "deployment-token",
    CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: "remote",
    AUTH_JWT_SECRET: "production-session-key",
    ASSET_PUBLIC_ORIGIN: "https://assets.example",
    VAKV_API_KEY: "paid-provider-key",
    LOCAL_IMAGE_GENERATION_ENABLED: "true",
    LOCAL_REDIS_URL: "redis://remote.example:6379",
    LOCAL_QUEUE_TOKEN: "production-token",
  };
  it("uses only Compose PostgreSQL in Docker, discarding production credentials and paid calls", () => {
    const env = localEnvironment(production, true);
    expect(new URL(env.DATABASE_URL).hostname).toBe("postgres");
    expect(env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE).toBe(env.DATABASE_URL);
    for (const key of [
      "SUPABASE_DATABASE_URL",
      "CLOUDFLARE_API_TOKEN",
      "AUTH_JWT_SECRET",
      "VAKV_API_KEY",
    ])
      expect(env).not.toHaveProperty(key);
    expect(env.LOCAL_IMAGE_GENERATION_ENABLED).toBe("false");
    expect(env.PATH).toBe(production.PATH);
    expect(env.ASSET_PUBLIC_ORIGIN).toBe("http://cdn.lycobo.localhost:8791");
    expect(env.LOCAL_REDIS_URL).toBe("redis://redis:6379");
    expect(env.LOCAL_QUEUE_TOKEN).not.toBe(production.LOCAL_QUEUE_TOKEN);
  });
  it("ignores a remote DATABASE_URL when running on the host", () => {
    const env = localEnvironment(production);
    expect(new URL(env.DATABASE_URL).hostname).toBe("127.0.0.1");
    expect(new URL(env.DATABASE_URL).port).toBe("55432");
    expect(env.LOCAL_REDIS_URL).toBe("redis://127.0.0.1:56379");
  });
});

it("imports explicitly enabled .env model settings while retaining local infrastructure", () => {
  const env = localEnvironment({ PATH: "/usr/bin" }, true, {
    IMAGE_GENERATION_ENABLED: "true",
    LOCAL_IMAGE_GENERATION_ENABLED: "false",
    VAKV_API_KEY: "local-provider-key",
    VAKV_ENABLE_IMAGE_EDITS: "true",
    VAKV_BASE_URL: "https://provider.example",
    GENERATION_TIMEOUT_MS: "120000",
    DATABASE_URL: "postgresql://secret@production.example/db",
    CLOUDFLARE_API_TOKEN: "production-token",
    VITE_SECRET: "do-not-import",
  });
  expect(env.LOCAL_IMAGE_GENERATION_ENABLED).toBe("true");
  expect(env.VAKV_ENABLE_IMAGE_EDITS).toBe("true");
  expect(env.VAKV_API_KEY).toBe("local-provider-key");
  expect(env.GENERATION_TIMEOUT_MS).toBe("120000");
  expect(new URL(env.DATABASE_URL).hostname).toBe("postgres");
  expect(env.LOCAL_REDIS_URL).toBe("redis://redis:6379");
  expect(env).not.toHaveProperty("CLOUDFLARE_API_TOKEN");
  expect(env).not.toHaveProperty("VITE_SECRET");
});

it("fails early when enabled model generation has no key or invalid flags", () => {
  expect(() => localEnvironment({}, false, { IMAGE_GENERATION_ENABLED: "true" })).toThrow(
    "VAKV_API_KEY",
  );
  expect(() => localEnvironment({}, false, { IMAGE_GENERATION_ENABLED: "yes" })).toThrow(
    "true or false",
  );
});
