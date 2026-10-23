import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { deploymentSettings, releaseConfig } from "./config.mjs";

// Generated deployment files contain resource configuration only, never runtime secrets.
const plan = process.argv.slice(2).includes("--plan");
let directory;
function run(label, args) {
  console.info(label);
  const result = spawnSync("pnpm", args, {
    stdio: "pipe",
    encoding: "utf8",
    timeout: 300000,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  });
  if (result.error || result.status !== 0) {
    let diagnostic = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    for (const [key, value] of Object.entries(process.env))
      if (value && /TOKEN|SECRET|PASSWORD|API_KEY|DATABASE_URL/.test(key))
        diagnostic = diagnostic.replaceAll(value, "[REDACTED]");
    console.error(
      diagnostic.replace(/postgres(?:ql)?:\/\/[^\s"']+/g, "[REDACTED_DATABASE_URL]").slice(-6000),
    );
    throw new Error(
      `${label} failed. Check Cloudflare authentication, subscriptions, bindings and deployment status; secret values redacted.`,
    );
  }
}
try {
  if (process.argv.slice(2).some((arg) => arg !== "--plan"))
    throw new Error("Only --plan is supported.");
  const settings = deploymentSettings(process.env);
  console.info(
    "Target: lycobo account; private R2; Queues; Hyperdrive caching must be disabled; runtime settings stay in Cloudflare.",
  );
  if (!plan) {
    if (!process.env.CLOUDFLARE_API_TOKEN)
      throw new Error("Set the scoped CLOUDFLARE_API_TOKEN before deploying.");
    // Read-only preflight: never purchases a plan, creates credentials, or modifies subscriptions.
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${settings.accountId}/hyperdrive/configs/${settings.hyperdrive}`,
      {
        headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
        signal: AbortSignal.timeout(15000),
      },
    );
    const data = await res.json();
    if (
      !res.ok ||
      data.result?.caching?.disabled !== true ||
      data.result?.origin?.host !== settings.databaseHost
    )
      throw new Error("Hyperdrive must exist with query caching disabled before deployment.");
    run("Build Pages", ["--filter", "@lycoboai/web", "build"]);
    directory = await mkdtemp(path.join(tmpdir(), "lycobo-cloudflare-"));
    for (const service of ["worker", "api"]) {
      const root = path.resolve(`apps/${service}`);
      const base = JSON.parse(await readFile(path.join(root, "wrangler.jsonc"), "utf8"));
      const configFile = path.join(directory, `${service}.json`);
      const config = releaseConfig(base, settings, root);
      delete config.tsconfig;
      await writeFile(configFile, JSON.stringify(config), {
        mode: 0o600,
      });
      run(`Deploy ${service} Worker`, ["exec", "wrangler", "deploy", "--config", configFile]);
    }
    // Pages configuration contains a service binding to the already deployed private API Worker.
    run("Deploy Pages", [
      "exec",
      "wrangler",
      "pages",
      "deploy",
      "dist",
      "--cwd",
      "apps/web",
      "--project-name",
      "lycobo",
      "--branch",
      "main",
      "--commit-dirty=true",
    ]);
    console.info(
      "Deployment commands completed. Verify the Pages URL, login/upload/history and Cloudflare runtime settings before accepting paid tasks.",
    );
  } else console.info("Plan validated; no resources or secrets were uploaded.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Cloudflare deployment failed.");
  process.exitCode = 1;
} finally {
  if (directory) await rm(directory, { recursive: true, force: true });
}
