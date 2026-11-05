import type { StoredImage } from "@lycoboai/contracts";
import type { ClaimedImage, ImageRuntimeRepository } from "@lycoboai/db";
import { ImageProviderError } from "@lycoboai/generation";
import { type ImageStore, providerReference } from "@lycoboai/storage";

// Every item of a job sends the same references, so each is read and re-encoded once per
// instance. Stored assets never change; the content hash is part of the key regardless.
const recent = new Map<string, Promise<Uint8Array>>();

/** Reference bytes for a provider request. A local-edit source is sent exactly as stored. */
export function providerReferenceBytes(
  store: Pick<ImageStore, "read">,
  asset: StoredImage,
  exact: boolean,
) {
  if (exact) return store.read(asset);
  const key = `${asset.id}:${asset.sha256}`;
  const cached = recent.get(key);
  if (cached) return cached;
  const pending = store.read(asset).then(providerReference);
  recent.set(key, pending);
  // A failed storage read must be retried on the next attempt, not served from the cache.
  pending.catch(() => recent.delete(key));
  if (recent.size > 10) {
    const oldest = recent.keys().next().value;
    if (oldest !== undefined) recent.delete(oldest);
  }
  return pending;
}

export async function readProviderReferences(
  job: ClaimedImage,
  repository: Pick<ImageRuntimeRepository, "asset">,
  store: Pick<ImageStore, "read">,
) {
  const references: Uint8Array[] = [];
  for (const id of job.input.referenceAssetIds) {
    const asset = await repository.asset(job, id);
    if (!asset) throw new ImageProviderError("REFERENCE_NOT_FOUND", false);
    references.push(await providerReferenceBytes(store, asset, !!job.input.localEdit));
  }
  return references;
}
