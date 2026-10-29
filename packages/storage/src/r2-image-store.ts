import { createHash, randomUUID } from "node:crypto";
import type { ImagesBinding } from "@cloudflare/workers-types";
import { type ImageScope, imageLimits } from "@lycoboai/contracts";
import {
  type ImageOutputSize,
  type ImageStore,
  ImageValidationError,
  objectKeySchema,
  type StorageUid,
  userObjectKey,
} from "./core";
import { type DisplayVariant, displayImage, displayObjectKey } from "./image-variants";
import type { ImageObjectBucket } from "./object-bucket";

const stream = (bytes: Uint8Array) => new Blob([new Uint8Array(bytes)]).stream();
const thumbnailKey = (key: string) => key.replace(/\.png$/, ".thumbnail.png");
const validateKey = (key: string) => {
  objectKeySchema.parse(key);
  if (!/^[0-9]{10}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/.test(key))
    throw new Error("INVALID_OBJECT_KEY");
  return key;
};

/** Private object storage only: callers must first resolve the asset through an owner-scoped repository. */
export function r2ImageStore(
  bucket: ImageObjectBucket,
  images: Pick<ImagesBinding, "info" | "input">,
  resolveUid: StorageUid,
): ImageStore {
  const inspect = async (bytes: Uint8Array) => {
    if (!bytes.length || bytes.length > imageLimits.outputBytes)
      throw new ImageValidationError("INVALID_IMAGE");
    let info: Awaited<ReturnType<typeof images.info>>;
    try {
      info = await images.info(stream(bytes));
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === 9412)
        throw new ImageValidationError("INVALID_IMAGE");
      throw new Error("IMAGE_PROCESSING_UNAVAILABLE");
    }
    if (
      !("width" in info) ||
      !["image/png", "image/jpeg", "image/webp"].includes(info.format) ||
      info.width < 1 ||
      info.height < 1 ||
      info.width > 8192 ||
      info.height > 8192 ||
      info.width * info.height > 32 * 1024 * 1024
    )
      throw new ImageValidationError("INVALID_IMAGE");
    // Reject APNG / animated WebP instead of silently flattening user uploads.
    const ascii = Buffer.from(bytes);
    if (info.format === "image/png") {
      let offset = 8;
      while (offset + 12 <= bytes.length) {
        const length = ascii.readUInt32BE(offset);
        const type = ascii.toString("ascii", offset + 4, offset + 8);
        if (type === "acTL") throw new ImageValidationError("INVALID_IMAGE");
        if (type === "IEND") break;
        offset += 12 + length;
      }
    }
    if (info.format === "image/webp") {
      let offset = 12;
      while (offset + 8 <= bytes.length) {
        const type = ascii.toString("ascii", offset, offset + 4);
        if (type === "ANIM" || type === "ANMF") throw new ImageValidationError("INVALID_IMAGE");
        offset += 8 + ascii.readUInt32LE(offset + 4) + (ascii.readUInt32LE(offset + 4) % 2);
      }
    }
    return info;
  };
  const png = async (bytes: Uint8Array, thumbnail = false, outputSize?: ImageOutputSize) => {
    let transform = images.input(stream(bytes));
    if (outputSize) transform = transform.transform({ ...outputSize, fit: "contain" });
    if (thumbnail) transform = transform.transform({ width: 512, height: 512, fit: "scale-down" });
    let result: Awaited<ReturnType<typeof transform.output>>;
    try {
      result = await transform.output({ format: "image/png", anim: false });
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === 9412)
        throw new ImageValidationError("INVALID_IMAGE");
      throw new Error("IMAGE_PROCESSING_UNAVAILABLE");
    }
    const response = result.response();
    const data = new Uint8Array(await response.arrayBuffer());
    if (!response.ok || !data.length || data.length > imageLimits.outputBytes)
      throw new Error("IMAGE_PROCESSING_UNAVAILABLE");
    return data;
  };
  return {
    async ready() {
      /* Bindings are validated by deployment; no public bucket probe. */
    },
    async put(
      scope: ImageScope,
      input: Uint8Array,
      id = randomUUID(),
      outputSize?: ImageOutputSize,
    ) {
      const key = userObjectKey(await resolveUid(scope), scope.organizationId, id);
      const source = await inspect(input);
      if (outputSize && (source.width < outputSize.width || source.height < outputSize.height))
        throw new ImageValidationError("OUTPUT_RESOLUTION_TOO_SMALL");
      const data = await png(input, false, outputSize);
      const info = await inspect(data);
      if (outputSize && (info.width !== outputSize.width || info.height !== outputSize.height))
        throw new ImageValidationError("OUTPUT_RESOLUTION_MISMATCH");
      const sha256 = createHash("sha256").update(data).digest("hex");
      const written = await bucket.put(key, data, {
        httpMetadata: { contentType: "image/png" },
        customMetadata: { sha256 },
      });
      if (!written) throw new Error("IMAGE_STORAGE_UNAVAILABLE");
      // Keep the paid original durable even if thumbnail processing subsequently fails.
      const thumbnail = await png(data, true);
      const thumbWritten = await bucket.put(thumbnailKey(key), thumbnail, {
        httpMetadata: { contentType: "image/png" },
      });
      if (!thumbWritten) throw new Error("IMAGE_STORAGE_UNAVAILABLE");
      for (const variant of ["thumbnail", "preview"] satisfies DisplayVariant[]) {
        const bytes = await displayImage(images, stream(data), variant);
        const variantWritten = await bucket.put(displayObjectKey(key, variant), bytes, {
          httpMetadata: { contentType: "image/webp" },
        });
        if (!variantWritten) throw new Error("IMAGE_STORAGE_UNAVAILABLE");
      }
      return {
        id,
        objectKey: key,
        mimeType: "image/png",
        bytes: data.length,
        width: info.width,
        height: info.height,
        sha256,
      };
    },
    async read(asset) {
      const object = await bucket.get(validateKey(asset.objectKey));
      if (!object || object.size > imageLimits.outputBytes)
        throw new Error("IMAGE_STORAGE_UNAVAILABLE");
      return new Uint8Array(await object.arrayBuffer());
    },
    async thumbnail(asset) {
      const key = validateKey(asset.objectKey);
      const cached = await bucket.get(thumbnailKey(key));
      if (cached && cached.size <= imageLimits.outputBytes)
        return new Uint8Array(await cached.arrayBuffer());
      const original = await bucket.get(key);
      if (!original || original.size > imageLimits.outputBytes)
        throw new Error("IMAGE_STORAGE_UNAVAILABLE");
      const bytes = await png(new Uint8Array(await original.arrayBuffer()), true);
      await bucket.put(thumbnailKey(key), bytes, { httpMetadata: { contentType: "image/png" } });
      return bytes;
    },
    async remove(asset) {
      await bucket.delete([
        validateKey(asset.objectKey),
        thumbnailKey(asset.objectKey),
        displayObjectKey(asset.objectKey, "preview"),
        displayObjectKey(asset.objectKey, "thumbnail"),
      ]);
    },
  };
}
