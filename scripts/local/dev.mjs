import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { localEnvironment } from "./environment.mjs";

let settings = {};
try {
  settings = parseEnv(await readFile(".env", "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const docker = process.argv.includes("--docker");
const configured = { ...settings, ...process.env };
const env = localEnvironment(process.env, docker, configured);
const moderationEnabled = configured.CREEM_MODERATION_ENABLED;
const creemKey = configured.CREEM_API_KEY?.trim();
// 本地子进程只接受测试密钥，浏览器和素材服务不继承账务配置。
const apiEnv = {
  ...env,
  ...(configured.IMAGE_AUTOMATION_KEY_SECRET
    ? { IMAGE_AUTOMATION_KEY_SECRET: configured.IMAGE_AUTOMATION_KEY_SECRET }
    : {}),
  ...(moderationEnabled ? { CREEM_MODERATION_ENABLED: moderationEnabled } : {}),
  ...(creemKey?.startsWith("creem_test_") ? { CREEM_API_KEY: creemKey } : {}),
  ...Object.fromEntries(
    [
      "BILLING_PROVIDER",
      "BILLING_PRODUCTS",
      "BILLING_OFFER_END_AT",
      "CREEM_WEBHOOK_SECRET",
    ].flatMap((key) => (configured[key] ? [[key, configured[key]]] : [])),
  ),
};
const workerEnv = creemKey?.startsWith("creem_test_") ? { ...env, CREEM_API_KEY: creemKey } : env;
const names = process.argv.includes("--api-only") ? ["api"] : ["api", "worker", "assets", "web"];
const children = names.map((name) =>
  spawn(
    "pnpm",
    ["--filter", `@lycoboai/${name}`, docker && name === "web" ? "dev:docker" : "dev"],
    {
      stdio: "inherit",
      env: { api: apiEnv, worker: workerEnv }[name] ?? env,
      detached: process.platform !== "win32",
    },
  ),
);
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try {
      if (process.platform !== "win32" && child.pid) process.kill(-child.pid, "SIGTERM");
      else child.kill("SIGTERM");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
}
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, stop);
for (const child of children) {
  child.on("error", () => {
    process.exitCode = 1;
    stop();
  });
  child.on("exit", (code) => {
    if (!stopping) {
      process.exitCode = code ?? 1;
      stop();
    }
  });
}
