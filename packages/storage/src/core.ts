import { type ImageScope, imageLimits, type StoredImage } from "@lycoboai/contracts";
import { z } from "zod";

export const maxImageBytes = imageLimits.uploadBytes;
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
export function userObjectKey(uid: string, organizationId: string, id: string) {
  z.string()
    .regex(/^[0-9]{10}$/)
    .parse(uid);
  z.uuid().parse(organizationId);
  z.uuid().parse(id);
  return `${uid}/${organizationId}/${id}.png`;
}
export type ImageOutputSize = { width: number; height: number };
export type ImageStorageTiming = {
  stage: "image_encode" | "image_original_put" | "image_variant_encode" | "image_variant_put";
  durationMs: number;
};
export interface ImageStore {
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
  remove(asset: StoredImage): Promise<unknown>;
}
