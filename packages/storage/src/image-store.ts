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

async function openImage(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > imageLimits.outputBytes) throw new Error("INVALID_IMAGE");
  const source = sharp(bytes, { limitInputPixels: 32 * 1024 * 1024, failOn: "warning" });
  const metadata = await source.metadata();
  if (!["png", "jpeg", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1)
    throw new Error("INVALID_IMAGE");
  return { source, metadata };
}

async function decodeImage(bytes: Uint8Array, outputSize?: ImageOutputSize) {
  const { source, metadata } = await openImage(bytes);
  if (outputSize) {
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    // Accept at most one 16-pixel alignment block of provider rounding per axis.
    // Keep these originals unchanged: resizing with contain would pad the missing pixels.
    if (width < outputSize.width || height < outputSize.height) {
      if (Math.abs(width - outputSize.width) > 15 || Math.abs(height - outputSize.height) > 15)
        throw new ImageValidationError("OUTPUT_RESOLUTION_TOO_SMALL");
    } else {
      source.resize({ ...outputSize, fit: "contain", withoutEnlargement: true });
    }
  }
  // Adaptive row filtering keeps originals lossless PNG but 11-25% smaller on photos, for
  // roughly 20 ms of extra encoding per megapixel; sharp disables it by default.
  const { data, info } = await source
    .rotate()
    .png({ adaptiveFiltering: true })
    .toBuffer({ resolveWithObject: true });
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
const providerReferenceEdge = 3840;
const storedReferenceBytes = 4 * 1024 * 1024;

/** Normalize reference uploads without affecting the stored resolution of paid outputs. */
export async function normalizeReferenceUpload(bytes: Uint8Array) {
  try {
    const { source, metadata } = await openImage(bytes);
    let edge = Math.min(providerReferenceEdge, Math.max(metadata.width, metadata.height));
    while (true) {
      const normalized = await source
        .clone()
        .rotate()
        .resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true })
        .png({ adaptiveFiltering: true })
        .toBuffer();
      if (normalized.length <= storedReferenceBytes) return normalized;
      const scale = Math.min(0.85, Math.sqrt(storedReferenceBytes / normalized.length) * 0.95);
      edge = Math.max(1, Math.floor(edge * scale));
    }
  } catch {
    throw new ImageValidationError("INVALID_IMAGE");
  }
}
/**
 * A stored lossless reference re-encoded for a provider request, whose upload is billed per
 * byte: JPEG quality 92 with full-resolution colour (4:4:4) is about 5 times smaller than the
 * stored PNG on product photos at 41-50 dB PSNR, capped at 3840 px. Transparent images stay
 * PNG. The stored bytes are kept when the copy would not be smaller or cannot be decoded.
 */
export async function providerReference(bytes: Uint8Array) {
  try {
    const input = () => sharp(bytes, { limitInputPixels: 32 * 1024 * 1024, failOn: "error" });
    const opaque = !(await input().metadata()).hasAlpha || (await input().stats()).isOpaque;
    const resized = input().resize({
      width: providerReferenceEdge,
      height: providerReferenceEdge,
      fit: "inside",
      withoutEnlargement: true,
    });
    const encoded = opaque
      ? await resized.jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: "4:4:4" }).toBuffer()
      : await resized.png({ adaptiveFiltering: true }).toBuffer();
    const metadata = await input().metadata();
    const oversized =
      (metadata.width ?? 0) > providerReferenceEdge ||
      (metadata.height ?? 0) > providerReferenceEdge;
    return oversized || encoded.length < bytes.length ? new Uint8Array(encoded) : bytes;
  } catch {
    return bytes;
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
