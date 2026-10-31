import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("prepares ignored local Wrangler configs in a clean checkout without starting services", async () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const directory = await mkdtemp(path.join(tmpdir(), "lycobo-dev-setup-"));
  try {
    for (const name of ["api", "worker", "assets"]) {
      await mkdir(path.join(directory, "apps", name), { recursive: true });
    }
    const output = execFileSync(
      process.execPath,
      [path.join(root, "scripts/cloudflare/dev.mjs"), "--prepare-only"],
      {
        cwd: directory,
        env: { PATH: process.env.PATH },
        encoding: "utf8",
        timeout: 10000,
      },
    );
    expect(output).toContain("no servers, queue or database connections started");
    for (const name of ["api", "worker", "assets"]) {
      const config = JSON.parse(
        await readFile(path.join(directory, "apps", name, "wrangler.local.json"), "utf8"),
      );
      expect(config.name).toBe(
        `${name === "worker" ? "lycobo-generation" : `lycobo-${name}`}-local`,
      );
      expect(config.queues).toBeUndefined();
      expect(config.triggers).toBeUndefined();
      expect(config.account_id).toBeUndefined();
      expect(config.r2_buckets[0].bucket_name).toBe("lycobo");
      const vars = await readFile(path.join(directory, "apps", name, ".dev.vars"), "utf8");
      expect(vars).not.toContain("api.ai-media.vip");
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
