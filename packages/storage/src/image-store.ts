import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { type ImageScope, imageLimits, type StoredImage } from "@lycoboai/contracts";
import sharp from "sharp";
import {
  type ImageOutputSize,
  ImageValidationError,
  objectKeySchema,
  type StorageUid,
  userObjectKey,
} from "./core";

export { ImageValidationError, maxImageBytes } from "./core";

async function decodeImage(bytes: Uint8Array, outputSize?: ImageOutputSize) {
  if (!bytes.length || bytes.length > imageLimits.outputBytes) throw new Error("INVALID_IMAGE");
  const source = sharp(bytes, { limitInputPixels: 32 * 1024 * 1024, failOn: "warning" });
  const metadata = await source.metadata();
  if (!["png", "jpeg", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1)
    throw new Error("INVALID_IMAGE");
  if (outputSize) {
    if ((metadata.width ?? 0) < outputSize.width || (metadata.height ?? 0) < outputSize.height)
      throw new ImageValidationError("OUTPUT_RESOLUTION_TOO_SMALL");
    source.resize({ ...outputSize, fit: "contain", withoutEnlargement: true });
  }
  const { data, info } = await source.rotate().png().toBuffer({ resolveWithObject: true });
  if (data.length > imageLimits.outputBytes || info.width > 8192 || info.height > 8192)
    throw new Error("INVALID_IMAGE");
  return { data, width: info.width, height: info.height };
}
export async function normalizeImage(bytes: Uint8Array, outputSize?: ImageOutputSize) {
  try {
    return await decodeImage(bytes, outputSize);
  } catch (error) {
    if (error instanceof ImageValidationError) throw error;
    throw new ImageValidationError("INVALID_IMAGE");
  }
}
export function imageStore(directory: string, resolveUid?: StorageUid) {
  const root = path.resolve(directory);
  const filename = (key: string) => {
    objectKeySchema.parse(key);
    const file = path.resolve(root, key);
    if (!file.startsWith(`${root}${path.sep}`)) throw new Error("INVALID_OBJECT_KEY");
    return file;
  };
  return {
    async ready() {
      await mkdir(root, { recursive: true, mode: 0o700 });
      await access(root, constants.R_OK | constants.W_OK);
    },
    async put(
      scope: ImageScope,
      input: Uint8Array,
      id: string = randomUUID(),
      outputSize?: ImageOutputSize,
    ): Promise<StoredImage> {
      const image = await normalizeImage(input, outputSize);
      const objectKey = resolveUid
        ? userObjectKey(await resolveUid(scope), scope.organizationId, id)
        : `${scope.organizationId}/${scope.userId}/${id}.png`;
      const file = filename(objectKey);
      await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
      const temporary = `${file}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, image.data, { mode: 0o600, flag: "wx" });
        await rename(temporary, file);
      } finally {
        await unlink(temporary).catch(() => {});
      }
      return {
        id,
        objectKey,
        mimeType: "image/png",
        bytes: image.data.length,
        width: image.width,
        height: image.height,
        sha256: createHash("sha256").update(image.data).digest("hex"),
      };
    },
    read: (asset: StoredImage) => readFile(filename(asset.objectKey)),
    async thumbnail(asset: StoredImage) {
      return sharp(await readFile(filename(asset.objectKey)))
        .resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();
    },
    remove: (asset: StoredImage) => unlink(filename(asset.objectKey)),
  };
}
export type { ImageStore } from "./core";
