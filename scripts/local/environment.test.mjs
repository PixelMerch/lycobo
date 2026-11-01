import { expect, it } from "vitest";
import { localEnvironment } from "./environment.mjs";

it("keeps business infrastructure local and discards production credentials", () => {
  const env = localEnvironment({
    PATH: "/usr/bin",
    DATABASE_URL: "postgresql://secret@remote/db",
    CLOUDBASE_APIKEY: "secret",
    TCB_SECRET_KEY: "secret",
    CLOUDFLARE_API_TOKEN: "secret",
    AUTH_JWT_SECRET: "production",
    S3_ENDPOINT: "https://remote",
    DEEPSEEK_API_KEY: "secret",
  });
  expect(new URL(env.DATABASE_URL).hostname).toBe("127.0.0.1");
  expect(new URL(env.S3_ENDPOINT).hostname).toBe("127.0.0.1");
  for (const key of [
    "CLOUDBASE_APIKEY",
    "TCB_SECRET_KEY",
    "CLOUDFLARE_API_TOKEN",
    "DEEPSEEK_API_KEY",
  ])
    expect(env).not.toHaveProperty(key);
  expect(env.AUTH_JWT_SECRET).not.toBe("production");
  expect(env.IMAGE_GENERATION_ENABLED).toBe("false");
  expect(env.PATH).toBe("/usr/bin");
});
it("only imports model secrets when generation is explicitly enabled", () => {
  const env = localEnvironment({}, true, {
    IMAGE_GENERATION_ENABLED: "true",
    MODEL_CREDENTIAL_SECRET: "fixture",
    STANDALONE_MODELS: "true",
    STANDALONE_IMAGE_API_KEY: "fixture-image",
    DEEPSEEK_API_KEY: "fixture-text",
  });
  expect(new URL(env.DATABASE_URL).hostname).toBe("postgres");
  expect(new URL(env.S3_ENDPOINT).hostname).toBe("image-storage");
  expect(env.DEEPSEEK_API_KEY).toBe("fixture-text");
  expect(() => localEnvironment({}, false, { IMAGE_GENERATION_ENABLED: "true" })).toThrow(
    "MODEL_CREDENTIAL_SECRET_REQUIRED",
  );
});
