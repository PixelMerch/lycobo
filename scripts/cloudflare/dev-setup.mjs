import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";

const enabled = process.env.LOCAL_IMAGE_GENERATION_ENABLED === "true";
if (enabled && !process.env.MODEL_CREDENTIAL_SECRET)
  throw new Error("Local generation requires MODEL_CREDENTIAL_SECRET and backend channels.");
const storage = Object.fromEntries(
  ["S3_ENDPOINT", "S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"].flatMap(
    (key) => (process.env[key] ? [[key, process.env[key]]] : []),
  ),
);
const common = {
  ...storage,
  ...(process.env.MODEL_CREDENTIAL_SECRET
    ? { MODEL_CREDENTIAL_SECRET: process.env.MODEL_CREDENTIAL_SECRET }
    : {}),
  IMAGE_GENERATION_ENABLED: String(enabled),
  ...(process.env.LOCAL_QUEUE_TOKEN ? { LOCAL_QUEUE_TOKEN: process.env.LOCAL_QUEUE_TOKEN } : {}),
};
const configs = {
  api: {
    ...common,
    APP_ENV: "development",
    ASSET_SIGNING_SECRET: process.env.ASSET_SIGNING_SECRET ?? "",
    ASSET_PUBLIC_ORIGIN: process.env.ASSET_PUBLIC_ORIGIN ?? "",
    AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET || randomBytes(48).toString("base64url"),
    AUTH_TRUSTED_ORIGINS:
      "http://localhost:8081,http://127.0.0.1:8081,http://localhost:5173,http://127.0.0.1:5173,http://localhost:8787,http://127.0.0.1:8787",
  },
  assets: {
    ...storage,
    ASSET_SIGNING_SECRET: process.env.ASSET_SIGNING_SECRET ?? "",
    ASSET_ALLOWED_ORIGINS: process.env.ASSET_ALLOWED_ORIGINS ?? "",
  },
  worker: {
    ...common,
  },
};
for (const [name, values] of Object.entries(configs))
  await writeFile(
    `apps/${name}/.dev.vars`,
    `${Object.entries(values)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join("\n")}\n`,
    { mode: 0o600 },
  );
console.info(
  "Prepared ignored local Worker settings. PostgreSQL, S3/R2 and Images are local; the development queue uses local Redis. Model generation uses IMAGE_GENERATION_ENABLED and encrypted backend channels only.",
);
