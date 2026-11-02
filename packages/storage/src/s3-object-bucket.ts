import { imageLimits } from "@lycoboai/contracts";
import { AwsClient } from "aws4fetch";
import { cloudbaseObjectBucket, readCloudBaseStorageConfig } from "./cloudbase-object-bucket";
import { objectKeySchema } from "./core";
import type { ImageObjectBucket, StorageBindings } from "./object-bucket";

import { readS3Config, s3ObjectUrl } from "./s3-config";

export type { StorageBindings } from "./object-bucket";
export type { S3Bindings } from "./s3-config";

/** No public S3 URLs: existing owner-scoped API / signed asset delivery remains authoritative. */
export function imageObjectBucket(
  env: StorageBindings,
  fallback?: ImageObjectBucket,
): ImageObjectBucket {
  // CloudBase is authoritative once configured, including missing objects and failures.
  // Never recover a deleted private object from an legacy copy.
  if (readCloudBaseStorageConfig(env)) return cloudbaseObjectBucket(env);
  const config = readS3Config(env);
  if (!config) {
    if (!fallback) throw new Error("IMAGE_STORAGE_NOT_CONFIGURED");
    return fallback;
  }
  const client = new AwsClient({
    accessKeyId: config.S3_ACCESS_KEY_ID,
    secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    region: config.S3_REGION,
    service: "s3",
    ...(config.S3_SESSION_TOKEN ? { sessionToken: config.S3_SESSION_TOKEN } : {}),
    retries: 1,
  });
  const request = async (key: string, method: string, data?: Uint8Array, headers?: Headers) => {
    objectKeySchema.parse(key);
    const url = s3ObjectUrl(config, key);
    try {
      const response = await client.fetch(url.href, {
        method,
        ...(headers ? { headers } : {}),
        ...(data ? { body: new Uint8Array(data) } : {}),
        signal: AbortSignal.timeout(config.S3_REQUEST_TIMEOUT_MS),
        // Do not follow redirects with storage credentials.
        redirect: "manual",
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
      if (!response) return fallback?.head(key) ?? null;
      return {
        size: Number(response.headers.get("content-length")),
        httpEtag: response.headers.get("etag") ?? '""',
      };
    },
    async get(key) {
      const response = await request(key, "GET");
      if (!response) return fallback?.get(key) ?? null;
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
      return {
        size,
        httpEtag: response.headers.get("ETag") ?? undefined,
        body: response.body,
        arrayBuffer: () => response.arrayBuffer(),
      };
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
        await fallback?.delete(key);
      }
    },
  };
}
