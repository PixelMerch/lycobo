import { spawnSync } from "node:child_process";

if (
  !process.env.CI &&
  spawnSync("git", ["rev-parse", "--git-dir"], { stdio: "ignore" }).status === 0
) {
  const result = spawnSync("git", ["config", "--local", "core.hooksPath", ".githooks"], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exitCode = 1;
}
