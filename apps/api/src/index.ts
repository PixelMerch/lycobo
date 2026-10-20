import { isAbsolute } from "node:path";
import { serve } from "@hono/node-server";
import { openImageRepository } from "@lycoboai/db";
import { readImagePolicy, supportedResolutions, validateModelInput } from "@lycoboai/generation";
import { imageStore } from "@lycoboai/storage";
import pino from "pino";
import { createApp } from "./app";
import { readEnv } from "./env";
import { readWorkbenchSession } from "./features/images/session";

const env = readEnv(process.env);
const logger = pino({ level: env.LOG_LEVEL });
const policy = readImagePolicy(process.env);
if (policy.enabled && !isAbsolute(process.env.IMAGE_DATA_DIR ?? ""))
  throw new Error("IMAGE_DATA_DIR must be an absolute shared directory");
const repository = process.env.DATABASE_URL ? openImageRepository(process.env.DATABASE_URL) : null;
if (policy.enabled && !repository) throw new Error("DATABASE_URL is required for the Image API");
const store = imageStore(process.env.IMAGE_DATA_DIR ?? "./data/images");
if (policy.enabled) await store.ready();
const app = createApp(
  (event) => logger.error(event, "Request failed"),
  repository
    ? {
        repository,
        store,
        enabled: policy.enabled,
        unitCredits: policy.unitCredits,
        editsEnabled: policy.editsEnabled,
        session: readWorkbenchSession(process.env),
        validate: (input) => validateModelInput(input, policy.overrides, policy.editsEnabled),
        resolutions: (model) => supportedResolutions(model, policy.overrides),
      }
    : undefined,
);
const server = serve({ fetch: app.fetch, hostname: env.API_HOST, port: env.API_PORT }, (info) => {
  const host = env.API_HOST === "0.0.0.0" || env.API_HOST === "::" ? "127.0.0.1" : env.API_HOST;
  const url = new URL(`http://localhost:${info.port}/api`);
  url.hostname = host.includes(":") ? `[${host}]` : host;
  if (process.env.NODE_ENV === "development" && process.env.DEV_API_PUBLIC_PORT) {
    url.port = process.env.DEV_API_PUBLIC_PORT;
  }
  logger.info({ host: env.API_HOST, port: info.port, url: url.href }, `API: ${url.href}`);
});
let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  const deadline = setTimeout(() => process.exit(1), 10_000).unref();
  server.close(async (error) => {
    try {
      await repository?.close();
      process.exitCode = error ? 1 : 0;
    } catch {
      process.exitCode = 1;
    } finally {
      clearTimeout(deadline);
    }
  });
  if ("closeIdleConnections" in server) server.closeIdleConnections();
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
