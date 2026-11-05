import { createHash } from "node:crypto";
import type { ImageObjectBucket } from "@lycoboai/storage/bucket";
import type { CopyEntry } from "./storage-copy-manifest";

export type CopyResult = {
  key: string;
  status: "copied" | "existing";
  bytes: number;
  sha256: string;
};
type SourceBucket = Pick<ImageObjectBucket, "get">;
type TargetBucket = Pick<ImageObjectBucket, "get" | "put">;
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

async function verifyCheckpoint(target: TargetBucket, entry: CopyEntry, previous?: CopyResult) {
  if (!previous || previous.key !== entry.key) return null;
  if (
    (entry.expectedBytes !== undefined && entry.expectedBytes !== previous.bytes) ||
    (entry.expectedSha256 !== undefined && entry.expectedSha256 !== previous.sha256)
  )
    throw new Error("SOURCE_CONTENT_MISMATCH");
  const stored = await target.get(entry.key);
  if (!stored) return null;
  const content = new Uint8Array(await stored.arrayBuffer());
  if (content.length !== previous.bytes || sha256(content) !== previous.sha256)
    throw new Error("TARGET_CONTENT_CONFLICT");
  return { ...previous, status: "existing" as const };
}

export async function copyStorageObject(
  source: SourceBucket,
  target: TargetBucket,
  entry: CopyEntry,
  previous?: CopyResult,
): Promise<CopyResult> {
  const checkpoint = await verifyCheckpoint(target, entry, previous);
  if (checkpoint) return checkpoint;
  const object = await source.get(entry.key);
  if (!object) throw new Error("SOURCE_OBJECT_MISSING");
  const bytes = new Uint8Array(await object.arrayBuffer());
  const hash = sha256(bytes);
  if (
    bytes.length !== object.size ||
    (entry.expectedBytes !== undefined && bytes.length !== entry.expectedBytes) ||
    (entry.expectedSha256 !== undefined && hash !== entry.expectedSha256)
  ) {
    throw new Error("SOURCE_CONTENT_MISMATCH");
  }
  const existing = await target.get(entry.key);
  if (existing) {
    const content = new Uint8Array(await existing.arrayBuffer());
    if (content.length !== bytes.length || sha256(content) !== hash) {
      throw new Error("TARGET_CONTENT_CONFLICT");
    }
    return { key: entry.key, status: "existing", bytes: bytes.length, sha256: hash };
  }
  await target.put(entry.key, bytes, {
    httpMetadata: { contentType: entry.mimeType },
    customMetadata: { sha256: hash },
  });
  const stored = await target.get(entry.key);
  if (!stored) throw new Error("TARGET_VERIFICATION_FAILED");
  const readback = new Uint8Array(await stored.arrayBuffer());
  if (readback.length !== bytes.length || sha256(readback) !== hash) {
    throw new Error("TARGET_VERIFICATION_FAILED");
  }
  return { key: entry.key, status: "copied", bytes: bytes.length, sha256: hash };
}

/** Only transient storage failures retry; a completed PUT is verified before any new write. */
export async function copyWithRetry(
  source: SourceBucket,
  target: TargetBucket,
  entry: CopyEntry,
  previous?: CopyResult,
): Promise<CopyResult> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await copyStorageObject(source, target, entry, previous);
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.message !== "IMAGE_STORAGE_UNAVAILABLE" ||
        attempt === 2
      )
        throw error;
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1000));
    }
  }
  throw new Error("STORAGE_RETRY_EXHAUSTED");
}

export function storageMigrationError(error: unknown) {
  const allowed = new Set([
    "SOURCE_OBJECT_MISSING",
    "SOURCE_CONTENT_MISMATCH",
    "TARGET_CONTENT_CONFLICT",
    "TARGET_VERIFICATION_FAILED",
    "IMAGE_STORAGE_UNAVAILABLE",
    "MIGRATION_TARGET_INVALID",
    "SOURCE_MANIFEST_INCOMPLETE",
    "STORAGE_NOT_PRIVATE",
  ]);
  return error instanceof Error && allowed.has(error.message)
    ? error.message
    : "STORAGE_MIGRATION_UNAVAILABLE";
}
