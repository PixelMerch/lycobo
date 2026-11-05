import { spawnSync } from "node:child_process";
import { chmod, readFile, realpath, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// One-time operator entrypoint. Reads original local environment values directly;
// never takes credentials as CLI arguments, embeds them in code, or prints them.
const repository = await realpath(fileURLToPath(new URL("../../", import.meta.url)));
if (!process.argv[2]) throw new Error("A prepared runtime directory is required");
const directory = await realpath(process.argv[2]);
if (directory === repository || directory.startsWith(repository + path.sep))
  throw new Error("Runtime directory must be outside the repository");
const envId = "lycobo-d9gyvxkegc54a1257";
if (process.env.CLOUDBASE_ENV_ID !== envId) throw new Error("CLOUDBASE_ENVIRONMENT_MISMATCH");
const origin = `https://${envId}-1311968085.ap-shanghai.app.tcloudbase.com`;
const keys = [
  "CLOUDBASE_ENV_ID",
  "CLOUDBASE_APIKEY",
  "CLOUDBASE_STORAGE_BUCKET",
  "AUTH_JWT_SECRET",
  "ASSET_SIGNING_SECRET",
  "MODEL_CREDENTIAL_SECRET",
  "STANDALONE_IMAGE_API_KEY",
  "DEEPSEEK_API_KEY",
];
for (const key of keys)
  if (!process.env[key]) throw new Error(`Required local credential is missing: ${key}`);
const source = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
const config = JSON.parse(await readFile(path.join(directory, "cloudbaserc.json"), "utf8"));
if (config.envId !== envId || config.functionRoot !== "." || config.functions.length !== 3)
  throw new Error("Unexpected runtime manifest");
const scopedKeys = {
  "lycobo-assets": [
    "CLOUDBASE_ENV_ID",
    "CLOUDBASE_APIKEY",
    "CLOUDBASE_STORAGE_BUCKET",
    "ASSET_SIGNING_SECRET",
  ],
  "lycobo-consumer": [
    "CLOUDBASE_ENV_ID",
    "CLOUDBASE_APIKEY",
    "CLOUDBASE_STORAGE_BUCKET",
    "MODEL_CREDENTIAL_SECRET",
    "STANDALONE_IMAGE_API_KEY",
    "DEEPSEEK_API_KEY",
  ],
};
for (const fn of config.functions) {
  if (!["lycobo-api", "lycobo-assets", "lycobo-consumer"].includes(fn.name))
    throw new Error("Unexpected function name");
  const allowed = scopedKeys[fn.name] ?? keys;
  fn.envVariables = {
    ...Object.fromEntries(allowed.map((key) => [key, source[key]])),
    NODE_ENV: "production",
    STANDALONE_MODELS: "true",
    API_HOST: "0.0.0.0",
    API_PORT: "9000",
    AUTH_TRUSTED_ORIGINS: `${origin},https://lycobo.com`,
    ASSET_ALLOWED_ORIGINS: `${origin},https://lycobo.com`,
    ASSET_PUBLIC_ORIGIN: origin,
    ASSET_PATH_PREFIX: "/_images/",
  };
}
const privateConfig = path.join(directory, "cloudbaserc.private.json");
let createdPrivateConfig = false;
try {
  await writeFile(privateConfig, JSON.stringify(config), { mode: 0o600, flag: "wx" });
  createdPrivateConfig = true;
  await chmod(privateConfig, 0o600);
  for (const fn of config.functions) {
    const args = [
      "--yes",
      "--package",
      "@cloudbase/cli@3.8.11",
      "tcb",
      "--config-file",
      privateConfig,
      "fn",
      "deploy",
      fn.name,
      "--dir",
      path.join(directory, fn.name),
      "--runtime",
      "Nodejs20.19",
      "--install-dependency",
      "false",
      "--force",
      "--json",
    ];
    if (fn.type === "HTTP") args.push("--httpFn");
    const result = spawnSync("npx", args, {
      cwd: directory,
      stdio: "pipe",
      env: process.env,
      timeout: 300000,
    });
    if (result.status !== 0)
      throw new Error(
        `Runtime bootstrap failed for ${fn.name}; inspect the CloudBase console (output withheld to protect runtime credentials)`,
      );
    console.log(
      `Deployed ${fn.name}; generation remains disabled; gateway validation still required`,
    );
  }
} finally {
  if (createdPrivateConfig) await unlink(privateConfig).catch(() => undefined);
}
