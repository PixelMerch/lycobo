import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { localEnvironment } from "./local-environment.mjs";

const docker = process.argv.includes("--docker");
const env = localEnvironment(process.env, docker);
// Refuse accidental remote bindings in the configs consumed by local development.
for (const name of ["api", "worker"]) {
  const config = JSON.parse(await readFile(`apps/${name}/wrangler.jsonc`, "utf8"));
  const rejectRemote = (value) => {
    if (!value || typeof value !== "object") return;
    if (value.remote === true)
      throw new Error("Remote bindings are forbidden in local development.");
    for (const child of Object.values(value)) rejectRemote(child);
  };
  rejectRemote(config);
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
const child = spawn(
  "pnpm",
  [
    "--parallel",
    "--filter",
    "@lycoboai/web",
    "--filter",
    "@lycoboai/api",
    process.argv.includes("--docker") ? "dev:docker" : "dev",
  ],
  { stdio: "inherit", env: process.env },
);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", () => {
  console.error("Unable to start local development processes.");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
