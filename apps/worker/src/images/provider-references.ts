import type { ImageGenerationInput, StoredImage } from "@lycoboai/contracts";
import type { ClaimedImage, ImageRuntimeRepository } from "@lycoboai/db";
import { ImageProviderError, itemReferenceAssetIds } from "@lycoboai/generation";
import type { ImageStore } from "@lycoboai/storage/core";

export type DeliverProviderReference = (asset: StoredImage, exact: boolean) => Promise<URL>;

// 同一任务的各条输出常共用参考图，每张图在本实例只读取、压缩一次。
// 已存的素材不会改变；缓存键始终包含内容哈希。
const recent = new WeakMap<object, Map<string, Promise<Uint8Array>>>();

/** 普通主图任务（非家纺、套图计划或局部修改）是否带参考图。 */
export function mainImageHasReferences(input: ImageGenerationInput) {
  return (
    input.referenceAssetIds.length > 0 && !input.textileSet && !input.variation && !input.localEdit
  );
}

/** 发给模型的参考图字节；局部修改的原图按原样发送，不压缩。 */
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
  // 存储读取失败时下次重试要重新读取，不能从缓存里拿到失败结果。
  const references = cache;
  pending.catch(() => references.delete(key));
  if (cache.size > 10) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return pending;
}

/** 读取一条输出要发送的全部参考图字节。 */
export async function readProviderReferences(
  job: ClaimedImage,
  repository: Pick<ImageRuntimeRepository, "asset">,
  store: Pick<ImageStore, "read" | "prepareProviderReference">,
) {
  return mapProviderReferences(job, repository, (asset) =>
    providerReferenceBytes(store, asset, !!job.input.localEdit),
  );
}

/** 按一条输出要发送的参考图逐张准备内容（字节或链接），缺图时报参考图不存在。 */
export async function mapProviderReferences<T>(
  job: ClaimedImage,
  repository: Pick<ImageRuntimeRepository, "asset">,
  prepare: (asset: StoredImage) => Promise<T>,
) {
  const references: T[] = [];
  // 套图计划的方案指定了参考图时只发这些；其他任务与旧方案仍发送任务的全部参考图。
  for (const id of itemReferenceAssetIds(job.input, job.position)) {
    const asset = await repository.asset(job, id);
    if (!asset) throw new ImageProviderError("REFERENCE_NOT_FOUND", false);
    references.push(await prepare(asset));
  }
  return references;
}
