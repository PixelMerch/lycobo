import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

if (!process.env.GITHUB_EVENT_PATH) throw new Error("GITHUB_EVENT_PATH is required");
const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
if (typeof event.pull_request?.title !== "string") throw new Error("PR title is missing");
const result = spawnSync("pnpm", ["exec", "commitlint"], {
  input: event.pull_request.title,
  stdio: ["pipe", "inherit", "inherit"],
  shell: false,
});
process.exitCode = result.status ?? 1;
