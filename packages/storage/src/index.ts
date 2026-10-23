export * from "./core";
export interface ObjectStorage {
  signUpload(input: {
    objectKey: string;
    contentType: "image/png" | "image/jpeg" | "image/webp";
    maxBytes: number;
  }): Promise<{ url: string; expiresAt: string }>;
  signDownload(objectKey: string): Promise<{ url: string; expiresAt: string }>;
}
// Generic upload signing is a future interface; private image delivery is implemented in ./delivery.

export * from "./image-store";
