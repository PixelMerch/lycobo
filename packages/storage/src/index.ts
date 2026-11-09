export * from "./images/core";
export interface ObjectStorage {
  signUpload(input: {
    objectKey: string;
    contentType: "image/png" | "image/jpeg" | "image/webp";
    maxBytes: number;
  }): Promise<{ url: string; expiresAt: string }>;
  signDownload(objectKey: string): Promise<{ url: string; expiresAt: string }>;
}
// 通用上传签名仅为未来接口，私有图片交付由 delivery 模块实现。

export * from "./local/image-store";
