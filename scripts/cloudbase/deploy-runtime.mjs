import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const runtimeEnvironment = "lycobo-d9gyvxkegc54a1257";
export const runtimeFunctions = ["lycobo-consumer", "lycobo-assets", "lycobo-api"];
export function decodeToolResult(result, label) {
  let decoded = result.structuredContent;
  if (!decoded) {
    const text = result.content?.find((item) => item.type === "text")?.text;
    try {
      decoded = JSON.parse(text ?? "");
    } catch {
      throw new Error(`${label}: INVALID_TOOL_RESPONSE`);
    }
  }
  if (!decoded || result.isError || decoded.success === false || decoded.ok === false)
    throw new Error(`${label}: TOOL_OPERATION_FAILED`);
  return decoded;
}
export function validateUpload(upload, name) {
  if (!runtimeFunctions.includes(name) || typeof upload.uploadUrl !== "string")
    throw new Error("INVALID_UPLOAD_TARGET");
  const url = new URL(upload.uploadUrl);
  const keyPattern = new RegExp(`^fnzip-upload/[0-9]{10}-[a-f0-9]{16}/${name}\\.zip$`);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    !/^[a-z0-9-]+\.cos\.ap-shanghai\.myqcloud\.com$/.test(url.hostname) ||
    upload.cosBucketRegion !== "ap-shanghai" ||
    !keyPattern.test(upload.cosObjectName ?? "") ||
    url.pathname !== `/${upload.cosObjectName}` ||
    typeof upload.cosBucketName !== "string" ||
    url.hostname.split(".cos.")[0].replace(/-\d+$/, "") !== upload.cosBucketName
  )
    throw new Error("INVALID_UPLOAD_TARGET");
  const headers = new Headers({ "Content-Type": "application/zip" });
  for (const item of upload.uploadHeaders ?? []) {
    if (item.Key?.toLowerCase() !== "x-cos-security-token" || typeof item.Value !== "string")
      throw new Error("INVALID_UPLOAD_HEADER");
    headers.set(item.Key, item.Value);
  }
  return { url, headers };
}
export async function publishRuntime({
  call,
  root,
  archiveDirectory,
  request = fetch,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  plan = false,
  functions = runtimeFunctions,
  removeUploadedObject,
}) {
  if (!plan && typeof removeUploadedObject !== "function") throw new Error("CODE_CLEANUP_REQUIRED");
  for (const name of functions) {
    if (!runtimeFunctions.includes(name)) throw new Error("INVALID_FUNCTION");
    const before = (
      await call("queryFunctions", { action: "getFunctionDetail", functionName: name })
    ).data.functionDetail;
    if (before.Status !== "Active") throw new Error(`${name}: FUNCTION_NOT_ACTIVE`);
    if (plan) {
      console.log(`Verified ${name}: Active`);
      continue;
    }
    const archive = path.join(archiveDirectory, `${name}.zip`);
    const zipped = spawnSync("zip", ["-qr", archive, "."], {
      cwd: path.join(root, name),
      stdio: "pipe",
    });
    if (zipped.status !== 0) throw new Error(`${name}: ZIP_FAILED`);
    await chmod(archive, 0o600);
    const bytes = await readFile(archive);
    if (bytes.length > 50 * 1024 * 1024) throw new Error(`${name}: ZIP_TOO_LARGE`);
    let uploaded;
    for (let attempt = 0; attempt < 3; attempt++) {
      const upload = (
        await call("queryFunctions", { action: "getFunctionUploadUrl", functionName: name })
      ).data;
      const { url, headers } = validateUpload(upload, name);
      try {
        const response = await request(url, {
          method: "PUT",
          headers,
          body: bytes,
          redirect: "manual",
          signal: AbortSignal.timeout(90000),
        });
        await response.body?.cancel();
        if (response.ok) {
          uploaded = upload;
          break;
        }
        if (![408, 429, 500, 502, 503, 504].includes(response.status))
          throw new Error("UPLOAD_REJECTED");
      } catch (error) {
        if (error?.message === "UPLOAD_REJECTED") throw new Error(`${name}: UPLOAD_REJECTED`);
      }
      if (attempt < 2) await wait(2000 * (attempt + 1));
    }
    if (!uploaded) throw new Error(`${name}: UPLOAD_FAILED`);
    // The MCP two-phase path uses the environment-owned COS bucket, never tempcos.
    // Code-only update preserves runtime variables, timeout, memory and gateway config.
    await call("manageFunctions", {
      action: "updateFunctionCode",
      functionName: name,
      code: {
        cosBucketName: uploaded.cosBucketName,
        cosBucketRegion: uploaded.cosBucketRegion,
        cosObjectName: uploaded.cosObjectName,
      },
      confirm: true,
    });
    let active = false;
    for (let attempt = 0; attempt < 45; attempt++) {
      await wait(2000);
      const current = (
        await call("queryFunctions", { action: "getFunctionDetail", functionName: name })
      ).data.functionDetail;
      if (current.Status === "Active" && current.ModTime !== before.ModTime) {
        active = true;
        break;
      }
      if (["CreateFailed", "UpdateFailed", "DeployFailed"].includes(current.Status))
        throw new Error(`${name}: DEPLOY_FAILED`);
    }
    if (!active) throw new Error(`${name}: DEPLOY_NOT_CONFIRMED`);
    await removeUploadedObject(uploaded, name);
    console.log(`Updated ${name}: Active; temporary code object deleted`);
  }
}
async function main() {
  if (!process.argv[2] || !process.argv[3])
    throw new Error("Prepared runtime and MCP client directories required");
  const root = await realpath(process.argv[2]);
  const repository = await realpath(fileURLToPath(new URL("../../", import.meta.url)));
  if (root === repository || root.startsWith(repository + path.sep))
    throw new Error("Runtime directory must be outside the repository");
  const manifest = JSON.parse(await readFile(path.join(root, "cloudbaserc.json"), "utf8"));
  if (manifest.envId !== runtimeEnvironment) throw new Error("CLOUDBASE_ENVIRONMENT_MISMATCH");
  const require = createRequire(path.join(await realpath(process.argv[3]), "package.json"));
  const { Client } = await import(
    pathToFileURL(require.resolve("@modelcontextprotocol/sdk/client/index.js"))
  );
  const { StdioClientTransport } = await import(
    pathToFileURL(require.resolve("@modelcontextprotocol/sdk/client/stdio.js"))
  );
  const client = new Client(
    { name: "lycobo-cloudbase-deployer", version: "1.0.0" },
    { capabilities: {} },
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(path.dirname(require.resolve("@cloudbase/cloudbase-mcp")), "cli.cjs")],
    cwd: root,
    env: { ...process.env, TCB_REGION: "ap-shanghai", TCB_SITE: "domestic" },
    stderr: "pipe",
  });
  // Do not forward MCP diagnostics: they may contain signed upload URLs or credentials.
  transport.stderr?.resume();
  const archiveDirectory = await mkdtemp(path.join(tmpdir(), "lycobo-code-upload-"));
  try {
    console.log("Connecting to the installed CloudBase deployment client");
    await client.connect(transport, { timeout: 120000 });
    console.log("CloudBase deployment client connected");
    const call = async (name, args) => {
      console.log(`CloudBase operation: ${name}/${args.action}`);
      return decodeToolResult(
        await client.callTool({ name, arguments: args }, undefined, { timeout: 120000 }),
        name,
      );
    };
    const status = await call("auth", { action: "status" });
    if (status.auth_status !== "READY") throw new Error("CLOUDBASE_DEPLOYMENT_AUTH_REQUIRED");
    if (status.current_env_id !== runtimeEnvironment) {
      await call("auth", { action: "set_env", envId: runtimeEnvironment });
      const bound = await call("auth", { action: "status" });
      if (bound.current_env_id !== runtimeEnvironment)
        throw new Error("CLOUDBASE_ENVIRONMENT_MISMATCH");
    }
    const COS = require("cos-nodejs-sdk-v5");
    await publishRuntime({
      call,
      root,
      archiveDirectory,
      plan: process.argv.includes("--plan"),
      removeUploadedObject: async (upload, name) => {
        const { url } = validateUpload(upload, name);
        const { credentials } = await call("auth", {
          action: "get_temp_credentials",
          confirm: "yes",
          reveal: true,
        });
        if (!credentials?.secretId || !credentials?.secretKey || credentials.masked)
          throw new Error("CODE_CLEANUP_CREDENTIALS_UNAVAILABLE");
        const cos = new COS({
          SecretId: credentials.secretId,
          SecretKey: credentials.secretKey,
          SecurityToken: credentials.token || undefined,
          Timeout: 30000,
        });
        await new Promise((resolve, reject) =>
          cos.deleteObject(
            {
              Bucket: url.hostname.split(".cos.")[0],
              Region: upload.cosBucketRegion,
              Key: upload.cosObjectName,
            },
            (error) =>
              error ? reject(new Error(`${name}: CODE_OBJECT_CLEANUP_FAILED`)) : resolve(),
          ),
        );
      },
    });
  } finally {
    await client.close();
    await rm(archiveDirectory, { recursive: true, force: true });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "CLOUDBASE_DEPLOYMENT_FAILED");
    process.exitCode = 1;
  });
}
