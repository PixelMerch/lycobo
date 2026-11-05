import { appendFile, chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { cloudbaseObjectBucket } from "@lycoboai/storage/cloudbase";
import { imageObjectBucket } from "@lycoboai/storage/s3";
import postgres from "postgres";
import { z } from "zod";
import { type CopyResult, copyWithRetry, storageMigrationError } from "./storage-copy";
import { createCopyManifest, migrationAssetSchema } from "./storage-copy-manifest";

const root = new URL("../../../", import.meta.url);
const directory = new URL("backups/storage/overseas-20261105/", root);
const destinationProject = "uyfgzmqijdsesnlsiwqu";
const sourceEnvironment = "lycobo-d9gyvxkegc54a1257";

async function privateJson(name: string, value: unknown) {
  const path = new URL(name, directory);
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
}

async function readProgress(journal: URL) {
  const schema = z.object({
    key: z.string(),
    status: z.enum(["copied", "existing"]),
    bytes: z.number().int().positive(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  });
  const results = new Map<string, CopyResult>();
  for (const line of (await readFile(journal, "utf8")).split("\n")) {
    if (!line) continue;
    const row = schema.safeParse(JSON.parse(line));
    if (row.success) results.set(row.data.key, row.data);
  }
  return results;
}

function validateEnvironments(
  source: Record<string, string | undefined>,
  target: Record<string, string | undefined>,
) {
  const database = new URL(target.SUPABASE_DATABASE_URL ?? "");
  const endpoint = new URL(target.S3_ENDPOINT ?? "");
  if (
    source.CLOUDBASE_ENV_ID !== sourceEnvironment ||
    source.CLOUDBASE_STORAGE_BUCKET !== "lycobo-images" ||
    target.SUPABASE_PROJECT_REF !== destinationProject ||
    database.username !== `postgres.${destinationProject}` ||
    database.hostname !== "aws-0-ap-southeast-1.pooler.supabase.com" ||
    database.port !== "5432" ||
    database.pathname !== "/postgres" ||
    database.searchParams.get("sslmode") !== "require" ||
    target.S3_BUCKET !== "lycobo-media-prod" ||
    endpoint.origin !== `https://${target.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com` ||
    endpoint.pathname !== "/" ||
    target.CLOUDBASE_ENV_ID ||
    target.CLOUDBASE_APIKEY
  ) {
    throw new Error("MIGRATION_TARGET_INVALID");
  }
}

async function checkPrivateAccess(env: Record<string, string | undefined>) {
  const base = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${env.S3_BUCKET}/domains/`;
  await Promise.all(
    ["managed", "custom"].map(async (type) => {
      const response = await fetch(base + type, {
        headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error("STORAGE_NOT_PRIVATE");
      const body: unknown = await response.json();
      const result =
        type === "managed"
          ? z.object({ enabled: z.literal(false) })
          : z.object({ domains: z.array(z.object({ enabled: z.literal(false) })) });
      if (!z.object({ success: z.literal(true), result }).safeParse(body).success)
        throw new Error("STORAGE_NOT_PRIVATE");
    }),
  );
}

async function loadManifest(env: Record<string, string | undefined>) {
  const sql = postgres(env.SUPABASE_DATABASE_URL ?? "", {
    max: 1,
    prepare: false,
    connect_timeout: 15,
  });
  try {
    const assets = await sql.begin(async (tx) => {
      await tx`set transaction read only`;
      return migrationAssetSchema
        .array()
        .parse(
          await tx`select id,object_key,media_type,mime_type,bytes,sha256,storage_deleted_at::text from media_assets order by object_key`,
        );
    });
    const raw: unknown = JSON.parse(
      await readFile(new URL("source-objects.json", directory), "utf8"),
    );
    const inventory = z
      .object({ rows: z.array(z.object({ objects: z.string() })).length(1) })
      .parse(raw);
    const first = inventory.rows[0];
    if (!first) throw new Error("SOURCE_MANIFEST_INCOMPLETE");
    const objects = z.array(z.object({ key: z.string() })).parse(JSON.parse(first.objects));
    const manifest = createCopyManifest(assets, new Set(objects.map((object) => object.key)));
    await privateJson("manifest.json", {
      source: sourceEnvironment,
      target: destinationProject,
      assets: assets.length,
      ...manifest,
    });
    if (manifest.missingOriginals.length) throw new Error("SOURCE_MANIFEST_INCOMPLETE");
    return manifest;
  } finally {
    await sql.end({ timeout: 3 });
  }
}

async function run() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--plan", "--sample", "--apply"].includes(args[0] ?? "")) {
    throw new Error("Use --plan, --sample or --apply");
  }
  const sourceEnv = parseEnv(await readFile(new URL(".env", root), "utf8"));
  const targetEnv = parseEnv(await readFile(new URL(".env.cloudflare", root), "utf8"));
  validateEnvironments(sourceEnv, targetEnv);
  await checkPrivateAccess(targetEnv);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const manifest = await loadManifest(targetEnv);
  console.log(
    JSON.stringify({
      objects: manifest.entries.length,
      deletedAssets: manifest.deletedAssets,
      mode: args[0],
    }),
  );
  if (args[0] === "--plan") return;
  const source = cloudbaseObjectBucket(sourceEnv);
  const target = imageObjectBucket(targetEnv);
  let entries = manifest.entries;
  if (args[0] === "--sample") {
    const video = entries.find((entry) => entry.mimeType === "video/mp4");
    entries = entries.slice(0, 4);
    if (video && !entries.includes(video)) entries.push(video);
  }
  const journal = new URL(args[0] === "--sample" ? "sample.jsonl" : "progress.jsonl", directory);
  await appendFile(journal, "", { mode: 0o600 });
  await chmod(journal, 0o600);
  const checkpoints = await readProgress(journal);
  let copied = 0,
    existing = 0,
    failures = 0,
    bytes = 0,
    cursor = 0;
  const work = async () => {
    while (cursor < entries.length) {
      const entry = entries[cursor++];
      if (!entry) return;
      try {
        const result = await copyWithRetry(source, target, entry, checkpoints.get(entry.key));
        if (result.status === "copied") copied += 1;
        else existing += 1;
        bytes += result.bytes;
        await appendFile(journal, `${JSON.stringify(result)}\n`);
      } catch (error) {
        failures += 1;
        await appendFile(
          journal,
          `${JSON.stringify({ key: entry.key, status: "failed", code: storageMigrationError(error) })}\n`,
        );
      }
      if ((copied + existing + failures) % 25 === 0)
        console.log(
          JSON.stringify({ completed: copied + existing, failures, total: entries.length }),
        );
    }
  };
  // Transfers do no media decoding; twelve bounded lanes overlap cross-region network waits.
  await Promise.all(Array.from({ length: 12 }, () => work()));
  const report = {
    total: entries.length,
    copied,
    existing,
    failures,
    bytes,
    completedAt: new Date().toISOString(),
  };
  await privateJson(args[0] === "--sample" ? "sample-report.json" : "report.json", report);
  console.log(JSON.stringify(report));
  if (failures) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await run().catch((error: unknown) => {
    console.error(storageMigrationError(error));
    process.exitCode = 1;
  });
}
