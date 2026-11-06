import type { S3Bindings } from "./s3-config";

export interface StorageBindings extends S3Bindings {
  [key: string]: string | undefined;
}

/** Minimal private object operations; authorization stays in the caller. */
export interface ImageObjectBucket {
  head(key: string): Promise<{ size: number; httpEtag: string } | null>;
  get(key: string): Promise<{
    size: number;
    httpEtag?: string | undefined;
    body: ReadableStream<Uint8Array>;
    arrayBuffer(): Promise<ArrayBuffer>;
  } | null>;
  put(
    key: string,
    data: Uint8Array,
    options?: {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
  delete(key: string | string[]): Promise<void>;
}
