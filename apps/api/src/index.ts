import { serve } from "@hono/node-server";
import pino from "pino";
import { createApp } from "./app";
import { readEnv } from "./env";

const env = readEnv(process.env);
const logger = pino({ level: env.LOG_LEVEL });
const app = createApp((event) => logger.error(event, "Request failed"));
const server = serve({ fetch: app.fetch, hostname: env.API_HOST, port: env.API_PORT }, () =>
  logger.info({ host: env.API_HOST, port: env.API_PORT }, "API listening"),
);
let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  const deadline = setTimeout(() => process.exit(1), 10_000).unref();
  server.close((error) => {
    clearTimeout(deadline);
    process.exitCode = error ? 1 : 0;
  });
  if ("closeIdleConnections" in server) server.closeIdleConnections();
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
