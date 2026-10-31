import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cloudbaseEnvironment, prepareWeb } from "./cloudbase/prepare-web.mjs";

describe("CloudBase static deployment package", () => {
  it.each([".env", ".env.production", "functions", "backups", "_worker.js"])(
    "refuses private or server material: %s",
    async (name) => {
      const root = await mkdtemp(path.join(tmpdir(), "lycobo-cloudbase-test-"));
      try {
        const source = path.join(root, "dist");
        await mkdir(source);
        await writeFile(path.join(source, "index.html"), '<div id="root"></div>');
        await writeFile(path.join(source, name), "fixture");
        await expect(prepareWeb(source, path.join(root, "stage"))).rejects.toThrow(
          "Only built static assets",
        );
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );
  it("refuses symlinks and does not overwrite an existing deployment directory", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "lycobo-cloudbase-test-"));
    try {
      const source = path.join(root, "dist");
      const target = path.join(root, "stage");
      await mkdir(source);
      await mkdir(target);
      await writeFile(path.join(source, "index.html"), '<div id="root"></div>');
      await symlink(path.join(root, "private"), path.join(source, "link"));
      await expect(prepareWeb(source, target)).rejects.toThrow("Only built static assets");
      await rm(path.join(source, "link"));
      await writeFile(path.join(target, "keep"), "existing");
      await expect(prepareWeb(source, target)).rejects.toThrow("must be empty");
      expect(await readFile(path.join(target, "keep"), "utf8")).toBe("existing");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("prepares only the built frontend with fixed target and no remote build", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "lycobo-cloudbase-test-"));
    try {
      const source = path.join(root, "dist");
      const target = path.join(root, "stage");
      await mkdir(path.join(source, "assets"), { recursive: true });
      await writeFile(path.join(source, "index.html"), '<div id="root"></div>');
      await writeFile(path.join(source, "assets", "app.js"), "fixture");
      await prepareWeb(source, target);
      const config = JSON.parse(await readFile(path.join(target, "cloudbaserc.json"), "utf8"));
      expect(config.envId).toBe(cloudbaseEnvironment);
      expect(config.app).toMatchObject({
        framework: "static",
        installCommand: "",
        buildCommand: "",
        outputDir: "./",
        deployPath: "/",
      });
      expect(await readFile(path.join(target, "assets", "app.js"), "utf8")).toBe("fixture");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
