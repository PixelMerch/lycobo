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
const names = process.argv.includes("--api-only") ? ["api"] : ["api", "worker", "assets", "web"];
const children = names.map((name) =>
  spawn("pnpm", ["--filter", `@lycoboai/${name}`, "dev"], {
    stdio: "inherit",
    env,
    detached: process.platform !== "win32",
  }),
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
