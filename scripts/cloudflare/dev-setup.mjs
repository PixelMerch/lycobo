import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";

const enabled = process.env.LOCAL_IMAGE_GENERATION_ENABLED === "true";
if (enabled && !process.env.VAKV_API_KEY)
  throw new Error("Local generation requires an explicit provider key.");
const common = {
  IMAGE_GENERATION_ENABLED: String(enabled),
  ...(process.env.LOCAL_QUEUE_TOKEN ? { LOCAL_QUEUE_TOKEN: process.env.LOCAL_QUEUE_TOKEN } : {}),
  VAKV_ENABLE_IMAGE_EDITS: process.env.VAKV_ENABLE_IMAGE_EDITS ?? "false",
};
const configs = {
  api: {
    ...common,
    APP_ENV: "development",
    AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET || randomBytes(48).toString("base64url"),
    AUTH_TRUSTED_ORIGINS:
      "http://localhost:8081,http://127.0.0.1:8081,http://localhost:5173,http://127.0.0.1:5173,http://localhost:8787,http://127.0.0.1:8787",
  },
  worker: {
    ...common,
    VAKV_API_KEY: process.env.VAKV_API_KEY ?? "",
    VAKV_BASE_URL: process.env.VAKV_BASE_URL || "https://api.vakv.cn",
    GENERATION_TIMEOUT_MS: "300000",
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
  "Prepared ignored local Worker settings. PostgreSQL, R2 and Images are local; the development queue uses local Redis. Real generation is disabled by the development launcher.",
);
