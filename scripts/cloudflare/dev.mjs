import { spawn } from "node:child_process";
import { supabaseMigrationTarget } from "../../packages/db/scripts/supabase-target.mjs";

// Validate the target without printing its credentials. No migrations or seed writes.
const { url } = supabaseMigrationTarget(process.env);
process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE = url;
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
