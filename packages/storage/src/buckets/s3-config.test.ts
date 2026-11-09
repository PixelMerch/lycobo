import { expect, it } from "vitest";
import { readS3Config, s3ObjectUrl } from "./s3-config";

const credentials = { S3_ACCESS_KEY_ID: "fixture-access", S3_SECRET_ACCESS_KEY: "fixture-secret" };
it.each([
  ["https://cos.ap-guangzhou.myqcloud.com", "ap-guangzhou", "generated-images-1250000000"],
  ["http://image-storage:8333", "us-east-1", "generated-images"],
])("uses the same S3 addressing rules for %s", (endpoint, region, bucket) => {
  for (const pathStyle of ["true", "false"]) {
    const config = readS3Config({
      ...credentials,
      S3_ENDPOINT: endpoint,
      S3_REGION: region,
      S3_BUCKET: bucket,
      S3_FORCE_PATH_STYLE: pathStyle,
    });
    if (!config) throw new Error("CONFIG_REQUIRED");
    const url = s3ObjectUrl(config, "model-logos/商品 logo.webp");
    expect(url.host).toBe(
      pathStyle === "true" ? new URL(endpoint).host : `${bucket}.${new URL(endpoint).host}`,
    );
    expect(url.pathname).toBe(
      `${pathStyle === "true" ? `/${bucket}` : ""}/model-logos/%E5%95%86%E5%93%81%20logo.webp`,
    );
    expect(config.S3_REGION).toBe(region);
    expect(config.S3_REQUEST_TIMEOUT_MS).toBe(20000);
  }
});
it("rejects partial or unsafe configuration without exposing credentials", () => {
  expect(readS3Config({})).toBeUndefined();
  for (const env of [
    credentials,
    {
      ...credentials,
      S3_ENDPOINT: "https://s3.example.com",
      S3_BUCKET: "private",
      S3_FORCE_PATH_STYLE: "yes",
    },
    { ...credentials, S3_ENDPOINT: "https://s3.example.com/bucket", S3_BUCKET: "private" },
    { ...credentials, S3_ENDPOINT: "https://user:password@s3.example.com", S3_BUCKET: "private" },
    { ...credentials, S3_ENDPOINT: "http://remote.example.com", S3_BUCKET: "private" },
    { ...credentials, S3_ENDPOINT: "https://s3.example.com?token=x", S3_BUCKET: "private" },
    {
      ...credentials,
      S3_ENDPOINT: "https://s3.example.com",
      S3_BUCKET: "private",
      S3_REQUEST_TIMEOUT_MS: "0",
    },
  ])
    expect(() => readS3Config(env)).toThrow("INVALID_S3_CONFIGURATION");
});
it("preserves temporary credentials and rejects object path traversal", () => {
  const config = readS3Config({
    ...credentials,
    S3_ENDPOINT: "https://s3.example.com",
    S3_BUCKET: "private",
    S3_SESSION_TOKEN: "fixture-session",
    S3_REQUEST_TIMEOUT_MS: "5000",
  });
  if (!config) throw new Error("CONFIG_REQUIRED");
  expect(config.S3_SESSION_TOKEN).toBe("fixture-session");
  expect(config.S3_REQUEST_TIMEOUT_MS).toBe(5000);
  for (const key of ["../private.png", "/absolute.png", "folder//image.png", "folder/./image.png"])
    expect(() => s3ObjectUrl(config, key)).toThrow("INVALID_OBJECT_KEY");
});

it("treats empty optional Docker values as omitted", () => {
  const config = readS3Config({
    ...credentials,
    S3_ENDPOINT: "https://s3.example.com",
    S3_BUCKET: "private",
    S3_SESSION_TOKEN: "",
    S3_PUBLIC_BASE_URL: "",
  });
  expect(config?.S3_SESSION_TOKEN).toBeUndefined();
  expect(config?.S3_PUBLIC_BASE_URL).toBeUndefined();
});

it("requires path style for dotted buckets and IP endpoints", () => {
  for (const env of [
    { S3_ENDPOINT: "https://s3.example.com", S3_BUCKET: "dotted.bucket" },
    { S3_ENDPOINT: "http://127.0.0.1:9002", S3_BUCKET: "logos" },
  ])
    expect(() => readS3Config({ ...credentials, ...env, S3_FORCE_PATH_STYLE: "false" })).toThrow(
      "INVALID_S3_CONFIGURATION",
    );
});
