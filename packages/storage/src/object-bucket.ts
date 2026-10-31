/** Minimal object operations shared by R2 and S3; authorization stays in the caller. */
export interface ImageObjectBucket {
  head(key: string): Promise<{ size: number; httpEtag: string } | null>;
  get(key: string): Promise<{
    size: number;
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
