import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { localConfig } from "./local-config.mjs";
import { localEnvironment } from "./local-environment.mjs";

const docker = process.argv.includes("--docker");
let fileSettings = {};
try {
  fileSettings = parseEnv(await readFile(".env", "utf8"));
} catch (error) {
  if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
}
// Never merge the whole .env into child processes: only model settings are allowlisted.
const env = localEnvironment(process.env, docker, { ...fileSettings, ...process.env });
// Local-only templates contain no account, production resource or publish configuration.
const configs = {};
for (const name of ["api", "worker", "assets"]) {
  configs[name] = localConfig(name);
}
for (const key of Object.keys(process.env)) delete process.env[key];
Object.assign(process.env, env);
if (docker) {
  const migrate = spawn("pnpm", ["db:migrate"], { stdio: "inherit", env });
  const status = await new Promise((resolve) => {
    migrate.on("error", () => resolve(1));
    migrate.on("exit", (code) => resolve(code ?? 1));
  });
  if (status !== 0) process.exit(1);
}
await import("./dev-setup.mjs");
configs.api.services = [{ binding: "LOCAL_CONSUMER", service: configs.worker.name }];
for (const [name, config] of Object.entries(configs))
  await writeFile(`apps/${name}/wrangler.local.json`, JSON.stringify(config, null, 2));

if (process.argv.includes("--prepare-only")) {
  console.info("Local Worker configs prepared; no servers, queue or database connections started.");
  process.exit(0);
}

console.info(`  Assets: ${env.ASSET_PUBLIC_ORIGIN}/ (local private image delivery)`);

const children = [
  spawn(process.execPath, ["scripts/cloudflare/redis-dev.mjs"], {
    stdio: "inherit",
    env,
    detached: process.platform !== "win32",
  }),
  spawn(
    "pnpm",
    [
      "--parallel",
      "--filter",
      "@lycoboai/web",
      "--filter",
      "@lycoboai/api",
      "--filter",
      "@lycoboai/assets",
      docker ? "dev:docker" : "dev",
    ],
    { stdio: "inherit", env, detached: process.platform !== "win32" },
  ),
];
let stopping = false;
const stop = (signal = "SIGTERM") => {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try {
      // pnpm launches Vite/Wrangler grandchildren; signal the whole process group.
      if (process.platform !== "win32" && child.pid) process.kill(-child.pid, signal);
      else child.kill(signal);
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ESRCH") throw error;
    }
  }
};
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop(signal));
for (const child of children) {
  child.on("error", () => {
    console.error("LOCAL_DEVELOPMENT_START_FAILED");
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
