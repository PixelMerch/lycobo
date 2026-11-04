import { spawnSync } from "node:child_process";
import { mkdir, readdir, realpath, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const output = path.resolve(process.argv[2] ?? "");
if (!process.argv[2] || output === root || output.startsWith(root + path.sep))
  throw new Error("Runtime output must be outside the repository");
await mkdir(output, { recursive: true, mode: 0o700 });
if ((await readdir(output)).length) throw new Error("Runtime output must be empty");
const require = createRequire(
  await realpath(
    fileURLToPath(new URL("../../apps/api/node_modules/tsup/package.json", import.meta.url)),
  ),
);
const { build } = require("esbuild");
const definitions = [
  {
    name: "lycobo-api",
    entry: "apps/api/src/index.ts",
    http: true,
    dependencies: { sharp: "0.35.5", postgres: "3.4.9", pino: "10.4.0" },
  },
  {
    name: "lycobo-assets",
    entry: "apps/api/src/assets-server.ts",
    http: true,
    dependencies: { "ffmpeg-static": "5.3.0" },
  },
  {
    name: "lycobo-consumer",
    entry: "apps/worker/src/cloudbase-consumer.ts",
    http: false,
    dependencies: { sharp: "0.35.5", postgres: "3.4.9" },
  },
];
await writeFile(
  path.join(output, "cloudbaserc.json"),
  JSON.stringify(
    {
      envId: "lycobo-d9gyvxkegc54a1257",
      functionRoot: ".",
      functions: definitions.map(({ name, http }) => ({
        name,
        runtime: "Nodejs20.19",
        handler: "index.main",
        type: http ? "HTTP" : "Event",
        timeout: name === "lycobo-assets" ? 60 : 900,
        memorySize: 512,
        installDependency: false,
      })),
    },
    null,
    2,
  ),
);
for (const definition of definitions) {
  const directory = path.join(output, definition.name);
  await mkdir(directory, { mode: 0o700 });
  await build({
    absWorkingDir: root,
    entryPoints: [definition.entry],
    outfile: path.join(directory, definition.http ? "index.mjs" : "index.js"),
    bundle: true,
    platform: "node",
    target: "node20",
    format: definition.http ? "esm" : "cjs",
    external: Object.keys(definition.dependencies),
    logLevel: "silent",
  });
  await writeFile(
    path.join(directory, "package.json"),
    JSON.stringify(
      {
        name: definition.name,
        version: "0.1.0",
        private: true,
        dependencies: definition.dependencies,
      },
      null,
      2,
    ) + "\n",
  );
  if (definition.http)
    await writeFile(
      path.join(directory, "scf_bootstrap"),
      "#!/bin/bash\nexec /var/lang/node20/bin/node index.mjs\n",
      { mode: 0o700 },
    );
  const installed = spawnSync(
    "npm",
    [
      "install",
      "--omit=dev",
      "--ignore-scripts",
      "--os=linux",
      "--cpu=x64",
      "--libc=glibc",
      "--no-audit",
      "--no-fund",
    ],
    { cwd: directory, stdio: "pipe" },
  );
  if (installed.status !== 0)
    throw new Error(`Runtime dependency installation failed: ${definition.name}`);
  if (definition.dependencies["ffmpeg-static"]) {
    const binary = spawnSync("node", ["node_modules/ffmpeg-static/install.js"], {
      cwd: directory,
      stdio: "pipe",
      timeout: 180000,
      env: { ...process.env, npm_config_platform: "linux", npm_config_arch: "x64", FFMPEG_BIN: "" },
    });
    if (binary.status !== 0) throw new Error("Video decoder preparation failed");
  }
  console.log(`Prepared ${definition.name} (Nodejs20.19, Linux x64)`);
}
