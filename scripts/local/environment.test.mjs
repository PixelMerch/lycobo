import { expect, it } from "vitest";
import { localEnvironment } from "./environment.mjs";

it("keeps business infrastructure local and discards production credentials", () => {
  const env = localEnvironment({
    PATH: "/usr/bin",
    DATABASE_URL: "postgresql://secret@remote/db",
    UNRELATED_API_KEY: "secret",
    CLOUDFLARE_API_TOKEN: "secret",
    AUTH_JWT_SECRET: "production",
    S3_ENDPOINT: "https://remote",
    DEEPSEEK_API_KEY: "secret",
  });
  expect(new URL(env.DATABASE_URL).hostname).toBe("127.0.0.1");
  expect(new URL(env.S3_ENDPOINT).hostname).toBe("127.0.0.1");
  for (const key of ["UNRELATED_API_KEY", "CLOUDFLARE_API_TOKEN", "DEEPSEEK_API_KEY"])
    expect(env).not.toHaveProperty(key);
  expect(env.AUTH_JWT_SECRET).not.toBe("production");
  expect(env).not.toHaveProperty("IMAGE_GENERATION_ENABLED");
  expect(env.PATH).toBe("/usr/bin");
});
it("imports configured model secrets without a generation enable flag", () => {
  const env = localEnvironment({}, true, {
    MODEL_CREDENTIAL_SECRET: "fixture",
    STANDALONE_MODELS: "true",
    STANDALONE_IMAGE_API_KEY: "fixture-image",
    DEEPSEEK_API_KEY: "fixture-text",
  });
  expect(new URL(env.DATABASE_URL).hostname).toBe("postgres");
  expect(new URL(env.S3_ENDPOINT).hostname).toBe("image-storage");
  expect(env.DEEPSEEK_API_KEY).toBe("fixture-text");
  expect(localEnvironment({}, false, {})).not.toHaveProperty("STANDALONE_IMAGE_API_KEY");
});

it("passes through only the configured provider reference origin and preserves local previews", () => {
  const env = localEnvironment({}, false, {
    VIDEO_REFERENCE_ORIGIN: "https://assets.example.com",
    ASSET_PUBLIC_ORIGIN: "https://production.example.com",
  });
  expect(env.VIDEO_REFERENCE_ORIGIN).toBe("https://assets.example.com");
  expect(env.ASSET_PUBLIC_ORIGIN).toBe("http://127.0.0.1:8791");
});

it("inherits process tooling without copying arbitrary deployment secrets", () => {
  const env = localEnvironment({
    PATH: "/usr/bin",
    HOME: "/tmp/fixture-home",
    HTTP_PROXY: "http://127.0.0.1:7890",
    DEV_WEB_PUBLIC_PORT: "8081",
    VENDOR_SECRET_TOKEN: "private-fixture",
    UNRECOGNIZED_DEPLOY_KEY: "private-fixture",
  });
  expect(env.PATH).toBe("/usr/bin");
  expect(env.HTTP_PROXY).toBe("http://127.0.0.1:7890");
  expect(env.DEV_WEB_PUBLIC_PORT).toBe("8081");
  expect(env).not.toHaveProperty("VENDOR_SECRET_TOKEN");
  expect(env).not.toHaveProperty("UNRECOGNIZED_DEPLOY_KEY");
});
