import { serve } from "@hono/node-server";
import pino from "pino";
import { createApp } from "./app";
import { readEnv } from "./env";

const env = readEnv(process.env);
const logger = pino({ level: env.LOG_LEVEL });
const app = createApp((event) => logger.error(event, "Request failed"));
const server = serve({ fetch: app.fetch, hostname: env.API_HOST, port: env.API_PORT }, (info) => {
  const host = env.API_HOST === "0.0.0.0" || env.API_HOST === "::" ? "127.0.0.1" : env.API_HOST;
  const url = new URL(`http://localhost:${info.port}/api`);
  url.hostname = host.includes(":") ? `[${host}]` : host;
  logger.info({ host: env.API_HOST, port: info.port, url: url.href }, `API: ${url.href}`);
});
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
