import type { StoredImage } from "@lycoboai/contracts";
import { ImageValidationError } from "@lycoboai/storage/core";
import type { Context } from "hono";
import { type Env, fail, type ImageApiDependencies } from "../route-context";

/** Isolated Node development keeps its synchronous upload path. */
export async function saveReferenceUpload(
  c: Context<Env>,
  deps: ImageApiDependencies,
  bytes: Uint8Array,
) {
  let asset: StoredImage;
  try {
    const prepared = deps.store.prepareReferenceUpload
      ? await deps.store.prepareReferenceUpload(bytes)
      : bytes;
    asset = await deps.store.put(c.get("principal"), prepared);
  } catch (error) {
    if (error instanceof ImageValidationError)
      return fail(c, "INVALID_IMAGE", "图片格式或尺寸无效", 400);
    throw error;
  }
  try {
    await deps.repository.addReference(c.get("principal"), asset);
  } catch (error) {
    await deps.store.remove(asset).catch(() => {
      // Preserve the repository failure if storage cleanup also fails.
    });
    throw error;
  }
  return c.json(
    {
      id: asset.id,
      width: asset.width,
      height: asset.height,
      bytes: asset.bytes,
      mimeType: asset.mimeType,
      ...(deps.signAsset ? { delivery: await deps.signAsset(asset.objectKey) } : {}),
    },
    201,
  );
}
