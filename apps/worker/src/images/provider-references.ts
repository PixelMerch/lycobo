import type { ImageGenerationInput, StoredImage } from "@lycoboai/contracts";
import type { ClaimedImage, ImageRuntimeRepository } from "@lycoboai/db";
import { ImageProviderError } from "@lycoboai/generation";
import type { ImageStore } from "@lycoboai/storage/core";

export type DeliverProviderReference = (asset: StoredImage, exact: boolean) => Promise<URL>;

// Every item of a job sends the same references, so each is read and re-encoded once per
// instance. Stored assets never change; the content hash is part of the key regardless.
const recent = new WeakMap<object, Map<string, Promise<Uint8Array>>>();

export function mainImageHasReferences(input: ImageGenerationInput) {
  return (
    input.referenceAssetIds.length > 0 && !input.textileSet && !input.variation && !input.localEdit
  );
}

/** Reference bytes for a provider request. A local-edit source is sent exactly as stored. */
export function providerReferenceBytes(
  store: Pick<ImageStore, "read" | "prepareProviderReference">,
  asset: StoredImage,
  exact: boolean,
) {
  if (exact) return store.read(asset);
  let cache = recent.get(store);
  if (!cache) {
    cache = new Map();
    recent.set(store, cache);
  }
  const key = `${asset.id}:${asset.sha256}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const pending = store
    .read(asset)
    .then((bytes) => store.prepareProviderReference?.(bytes) ?? bytes);
  cache.set(key, pending);
  // A failed storage read must be retried on the next attempt, not served from the cache.
  const references = cache;
  pending.catch(() => references.delete(key));
  if (cache.size > 10) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return pending;
}

export async function readProviderReferences(
  job: ClaimedImage,
  repository: Pick<ImageRuntimeRepository, "asset">,
  store: Pick<ImageStore, "read" | "prepareProviderReference">,
) {
  return mapProviderReferences(job, repository, (asset) =>
    providerReferenceBytes(store, asset, !!job.input.localEdit),
  );
}

export async function mapProviderReferences<T>(
  job: ClaimedImage,
  repository: Pick<ImageRuntimeRepository, "asset">,
  prepare: (asset: StoredImage) => Promise<T>,
) {
  const references: T[] = [];
  for (const id of job.input.referenceAssetIds) {
    const asset = await repository.asset(job, id);
    if (!asset) throw new ImageProviderError("REFERENCE_NOT_FOUND", false);
    references.push(await prepare(asset));
  }
  return references;
}
