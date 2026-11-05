import { displayObjectKey, providerReferenceObjectKey } from "@lycoboai/storage/variants";
import { z } from "zod";

export const migrationAssetSchema = z.object({
  id: z.uuid(),
  object_key: z.string().min(1),
  media_type: z.enum(["image", "video", "audio"]),
  mime_type: z.string().min(1),
  bytes: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  storage_deleted_at: z.string().nullable(),
});
export type MigrationAsset = z.infer<typeof migrationAssetSchema>;
export type CopyEntry = {
  key: string;
  assetId: string;
  kind: "original" | "derived";
  mimeType: string;
  expectedBytes?: number;
  expectedSha256?: string;
};

function derivatives(asset: MigrationAsset) {
  const key = asset.object_key;
  if (asset.media_type === "video") return [`${key}.thumbnail.webp`];
  if (asset.media_type !== "image") return [];
  return [
    displayObjectKey(key, "preview"),
    displayObjectKey(key, "thumbnail"),
    key.replace(/\.png$/, ".thumbnail.png"),
    providerReferenceObjectKey(key, "jpg"),
    providerReferenceObjectKey(key, "png"),
  ].filter((candidate) => candidate !== key);
}

function derivedMimeType(key: string) {
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".jpg")) return "image/jpeg";
  return "image/png";
}

export function createCopyManifest(assets: MigrationAsset[], sourceKeys: Set<string>) {
  const entries = new Map<string, CopyEntry>();
  const missingOriginals: string[] = [];
  let deletedAssets = 0;
  for (const asset of assets) {
    if (asset.storage_deleted_at) {
      deletedAssets += 1;
      continue;
    }
    if (!sourceKeys.has(asset.object_key)) missingOriginals.push(asset.id);
    entries.set(asset.object_key, {
      key: asset.object_key,
      assetId: asset.id,
      kind: "original",
      mimeType: asset.mime_type,
      expectedBytes: asset.bytes,
      expectedSha256: asset.sha256,
    });
    for (const key of derivatives(asset)) {
      if (!sourceKeys.has(key)) continue;
      entries.set(key, { key, assetId: asset.id, kind: "derived", mimeType: derivedMimeType(key) });
    }
  }
  return { entries: [...entries.values()], missingOriginals, deletedAssets };
}
