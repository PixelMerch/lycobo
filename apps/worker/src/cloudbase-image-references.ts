import { createHash } from "node:crypto";
import type { StoredImage } from "@lycoboai/contracts";
import type { ImageStore } from "@lycoboai/storage";
import type { ImageObjectBucket } from "@lycoboai/storage/bucket";
import { providerReferenceObjectKey } from "@lycoboai/storage/variants";
import { providerReferenceBytes } from "./provider-references";

export type DeliverProviderReference = (asset: StoredImage, exact: boolean) => Promise<URL>;

/** One cache per drain. Even the earliest signed URL outlives the invocation. */
export function cloudbaseImageReferences(
  bucket: Pick<ImageObjectBucket, "head" | "put">,
  store: Pick<ImageStore, "read">,
  sign: (key: string) => Promise<URL>,
): DeliverProviderReference {
  const recent = new Map<string, Promise<URL>>();
  async function prepare(asset: StoredImage, exact: boolean) {
    if (exact) return sign(asset.objectKey);
    const jpeg = providerReferenceObjectKey(asset.objectKey, "jpg");
    if (await bucket.head(jpeg)) return sign(jpeg);
    const png = providerReferenceObjectKey(asset.objectKey, "png");
    if (await bucket.head(png)) return sign(png);
    const bytes = await providerReferenceBytes(store, asset, false);
    // Normalization keeps the original when re-encoding is unnecessary.
    if (
      bytes.length === asset.bytes &&
      createHash("sha256").update(bytes).digest("hex") === asset.sha256
    )
      return sign(asset.objectKey);
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const key = isJpeg ? jpeg : png;
    await bucket.put(key, bytes, {
      httpMetadata: { contentType: isJpeg ? "image/jpeg" : "image/png" },
    });
    return sign(key);
  }
  return (asset, exact) => {
    const cacheKey = `${asset.objectKey}:${exact}`;
    const cached = recent.get(cacheKey);
    if (cached) return cached;
    const pending = prepare(asset, exact);
    recent.set(cacheKey, pending);
    pending.catch(() => recent.delete(cacheKey));
    return pending;
  };
}
