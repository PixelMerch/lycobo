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
  };
  it("uses only Compose PostgreSQL in Docker, discarding production credentials and paid calls", () => {
    const env = localEnvironment(production, true);
    expect(new URL(env.DATABASE_URL).hostname).toBe("postgres");
    expect(env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE).toBe(env.DATABASE_URL);
    for (const key of [
      "SUPABASE_DATABASE_URL",
      "CLOUDFLARE_API_TOKEN",
      "AUTH_JWT_SECRET",
      "ASSET_PUBLIC_ORIGIN",
      "VAKV_API_KEY",
    ])
      expect(env).not.toHaveProperty(key);
    expect(env.LOCAL_IMAGE_GENERATION_ENABLED).toBe("false");
    expect(env.PATH).toBe(production.PATH);
  });
  it("ignores a remote DATABASE_URL when running on the host", () => {
    const env = localEnvironment(production);
    expect(new URL(env.DATABASE_URL).hostname).toBe("127.0.0.1");
    expect(new URL(env.DATABASE_URL).port).toBe("55432");
  });
});
