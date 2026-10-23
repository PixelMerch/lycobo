export * from "./core";
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
