import {
  automationReferenceLimits,
  type ImageScope,
  imageLimits,
  type StoredImage,
} from "@lycoboai/contracts";
import { z } from "zod";

export const maxImageBytes = imageLimits.uploadBytes;
/** 表示上传字节或图片尺寸未通过校验。 */
export class ImageValidationError extends Error {}
export const objectKeySchema = z
  .string()
  .min(1)
  .max(1024)
  .refine(
    (key) =>
      !key.startsWith("/") &&
      !key.includes("\\") &&
      !key.split("/").some((part) => part === ".." || part === "." || part === "") &&
      !Array.from(key).some(
        (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      ),
    "Invalid object key",
  );
export type StorageUid = (scope: ImageScope) => Promise<string>;
/** 生成校验过的私有图片对象键。 */
export function userObjectKey(
  uid: string,
  organizationId: string,
  id: string,
  extension: "png" | "webp" = "png",
) {
  z.string()
    .regex(/^[0-9]{10}$/)
    .parse(uid);
  z.uuid().parse(organizationId);
  z.uuid().parse(id);
  return `${uid}/${organizationId}/${id}.${extension}`;
}
/** 验证由设备压缩的参考图字节大小、格式及实际像素尺寸。 */
export function validateAutomationReference(
  input: Uint8Array,
  metadata: {
    format?: string | undefined;
    width?: number | undefined;
    height?: number | undefined;
  },
) {
  const { format, width = 0, height = 0 } = metadata;
  if (
    !input.length ||
    input.length > automationReferenceLimits.maxBytes ||
    (format !== "webp" && format !== "image/webp") ||
    width < 1 ||
    height < 1 ||
    Math.max(width, height) > automationReferenceLimits.maxEdge
  )
    throw new ImageValidationError("INVALID_IMAGE");
  return { width, height };
}
export type ImageOutputSize = { width: number; height: number };
export type ImageStorageTiming = {
  stage:
    | "image_encode"
    | "image_metadata"
    | "image_source_put"
    | "image_source_delete"
    | "image_original_put"
    | "image_variant_encode"
    | "image_variant_put";
  durationMs: number;
};
/** 区分普通生图存储和已经由设备编码的自动化参考图。 */
export interface ImageStore {
  putAutomationReference?(scope: ImageScope, input: Uint8Array): Promise<StoredImage>;
  prepareReferenceUpload?(bytes: Uint8Array): Promise<Uint8Array>;
  prepareProviderReference?(bytes: Uint8Array): Promise<Uint8Array>;
  ready(): Promise<void>;
  put(
    scope: ImageScope,
    input: Uint8Array,
    id?: string,
    outputSize?: ImageOutputSize,
    onTiming?: (event: ImageStorageTiming) => void,
  ): Promise<StoredImage>;
  read(asset: StoredImage): Promise<Uint8Array>;
  thumbnail(asset: StoredImage): Promise<Uint8Array>;
  readDisplayThumbnail?(objectKey: string): Promise<Uint8Array | null>;
  remove(asset: StoredImage): Promise<unknown>;
}
