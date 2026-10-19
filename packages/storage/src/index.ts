import { z } from "zod";
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
export interface ObjectStorage {
  signUpload(input: {
    objectKey: string;
    contentType: "image/png" | "image/jpeg" | "image/webp";
    maxBytes: number;
  }): Promise<{ url: string; expiresAt: string }>;
  signDownload(objectKey: string): Promise<{ url: string; expiresAt: string }>;
}
// Signed object storage is not implemented; the private local image store is exported separately.

export * from "./image-store";
