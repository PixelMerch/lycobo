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
const env = localEnvironment(process.env, docker, { ...settings, ...process.env });
const moderationEnabled = process.env.CREEM_MODERATION_ENABLED ?? settings.CREEM_MODERATION_ENABLED;
const creemKey = (process.env.CREEM_API_KEY ?? settings.CREEM_API_KEY)?.trim();
// 本地审核只允许 API 子进程使用 Creem 测试密钥。
const apiEnv = {
  ...env,
  ...(moderationEnabled ? { CREEM_MODERATION_ENABLED: moderationEnabled } : {}),
  ...(moderationEnabled === "true" && creemKey?.startsWith("creem_test_")
    ? { CREEM_API_KEY: creemKey }
    : {}),
};
const names = process.argv.includes("--api-only") ? ["api"] : ["api", "worker", "assets", "web"];
const children = names.map((name) =>
  spawn(
    "pnpm",
    ["--filter", `@lycoboai/${name}`, docker && name === "web" ? "dev:docker" : "dev"],
    {
      stdio: "inherit",
      env: name === "api" ? apiEnv : env,
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
