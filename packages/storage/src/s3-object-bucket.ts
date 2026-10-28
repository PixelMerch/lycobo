import { imageLimits } from "@lycoboai/contracts";
import { AwsClient } from "aws4fetch";
import { z } from "zod";
import { objectKeySchema } from "./core";
import type { ImageObjectBucket } from "./object-bucket";

export interface S3Bindings {
  S3_ENDPOINT?: string;
  S3_BUCKET?: string;
  S3_REGION?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
}
/** No public S3 URLs: existing owner-scoped API / signed asset delivery remains authoritative. */
export function imageObjectBucket(env: S3Bindings, fallback: ImageObjectBucket): ImageObjectBucket {
  if (!env.S3_ENDPOINT) return fallback;
  const config = z
    .object({
      S3_ENDPOINT: z.url(),
      S3_BUCKET: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/),
      S3_REGION: z.string().default("us-east-1"),
      S3_ACCESS_KEY_ID: z.string().min(1),
      S3_SECRET_ACCESS_KEY: z.string().min(1),
    })
    .parse(env);
  const endpoint = new URL(config.S3_ENDPOINT);
  if (
    !["https:", "http:"].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.pathname !== "/"
  )
    throw new Error("INVALID_S3_CONFIGURATION");
  const client = new AwsClient({
    accessKeyId: config.S3_ACCESS_KEY_ID,
    secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    region: config.S3_REGION,
    service: "s3",
    retries: 1,
  });
  const request = async (key: string, method: string, data?: Uint8Array, headers?: Headers) => {
    objectKeySchema.parse(key);
    const url = new URL(
      `/${config.S3_BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`,
      endpoint,
    );
    try {
      const response = await client.fetch(url.href, {
        method,
        ...(headers ? { headers } : {}),
        ...(data ? { body: new Uint8Array(data) } : {}),
        signal: AbortSignal.timeout(20000),
        redirect: "error",
      });
      if (response.status === 404) {
        await response.body?.cancel();
        return null;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error("IMAGE_STORAGE_UNAVAILABLE");
      }
      return response;
    } catch {
      throw new Error("IMAGE_STORAGE_UNAVAILABLE");
    }
  };
  return {
    async head(key) {
      const response = await request(key, "HEAD");
      if (!response) return fallback.head(key);
      return {
        size: Number(response.headers.get("content-length")),
        httpEtag: response.headers.get("etag") ?? '""',
      };
    },
    async get(key) {
      const response = await request(key, "GET");
      if (!response) return fallback.get(key);
      const size = Number(response.headers.get("content-length"));
      if (
        !response.body ||
        !Number.isSafeInteger(size) ||
        size < 1 ||
        size > imageLimits.outputBytes
      ) {
        await response.body?.cancel();
        throw new Error("IMAGE_STORAGE_UNAVAILABLE");
      }
      return { size, body: response.body, arrayBuffer: () => response.arrayBuffer() };
    },
    async put(key, data, options) {
      const headers = new Headers({
        "content-type": options?.httpMetadata?.contentType ?? "application/octet-stream",
      });
      for (const [key, value] of Object.entries(options?.customMetadata ?? {}))
        headers.set(`x-amz-meta-${key}`, value);
      const result = await request(key, "PUT", data, headers);
      if (!result) throw new Error("IMAGE_STORAGE_UNAVAILABLE");
      await result.body?.cancel();
      return { stored: true };
    },
    async delete(keys) {
      for (const key of typeof keys === "string" ? [keys] : keys) {
        const response = await request(key, "DELETE");
        await response?.body?.cancel();
        // Remove legacy copies too, so a deleted S3 object cannot reappear via fallback.
        await fallback.delete(key);
      }
    },
  };
}
