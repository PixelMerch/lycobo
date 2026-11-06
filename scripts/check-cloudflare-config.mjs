import { readFile } from "node:fs/promises";
import { configurationDifferences } from "./cloudflare-config.mjs";

/** 只读检查 Cloudflare 发布状态，控制台草稿与活动版本不一致时拒绝通过。 */
async function checkConfiguration(file) {
  const config = JSON.parse(await readFile(file, "utf8"));
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token || !config.account_id) throw new Error("CLOUDFLARE_CREDENTIALS_REQUIRED");
  if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_ACCOUNT_ID !== config.account_id)
    throw new Error("CLOUDFLARE_ACCOUNT_MISMATCH");
  const base = `https://api.cloudflare.com/client/v4/accounts/${config.account_id}/workers/scripts/${config.name}`;
  const get = async (path) => {
    const response = await fetch(base + path, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`CLOUDFLARE_HTTP_${response.status}`);
    const body = await response.json();
    if (!body.success || !body.result) throw new Error("CLOUDFLARE_RESPONSE_INVALID");
    return body.result;
  };
  const [settings, deployments] = await Promise.all([get("/settings"), get("/deployments")]);
  const deployment = deployments.deployments[0];
  if (deployment?.versions.length !== 1 || deployment.versions[0].percentage !== 100)
    throw new Error("SINGLE_ACTIVE_VERSION_REQUIRED");
  const versionId = deployment.versions[0].version_id;
  const version = await get(`/versions/${versionId}`);
  const differences = configurationDifferences(
    config,
    settings.bindings,
    version.resources.bindings,
  );
  console.info({ worker: config.name, activeVersion: versionId, differences });
  return differences.length === 0;
}

const files = process.argv.slice(2);
for (const file of files.length ? files : ["wrangler.jsonc", "wrangler.images.jsonc"]) {
  try {
    if (!(await checkConfiguration(file))) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "CLOUDFLARE_CHECK_FAILED");
    process.exitCode = 1;
  }
}
