import { imageLimits } from "@lycoboai/contracts";
import { z } from "zod";
import { objectKeySchema } from "./core";
import type { ImageObjectBucket } from "./object-bucket";

export interface CloudBaseStorageBindings {
  CLOUDBASE_ENV_ID?: string;
  CLOUDBASE_STORAGE_BUCKET?: string;
  CLOUDBASE_APIKEY?: string;
}
const configSchema = z.object({
  CLOUDBASE_ENV_ID: z.string().regex(/^[a-z0-9][a-z0-9-]{5,99}$/),
  CLOUDBASE_STORAGE_BUCKET: z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/),
  CLOUDBASE_APIKEY: z.string().min(1).max(8192),
});
export function readCloudBaseStorageConfig(env: CloudBaseStorageBindings) {
  if (!env.CLOUDBASE_ENV_ID && !env.CLOUDBASE_STORAGE_BUCKET && !env.CLOUDBASE_APIKEY) return null;
  const result = configSchema.safeParse(env);
  if (!result.success) throw new Error("CLOUDBASE_STORAGE_NOT_CONFIGURED");
  return result.data;
}

/** PG private storage; access keys and unsigned object endpoints remain server-side. */
export function cloudbaseObjectBucket(
  env: CloudBaseStorageBindings,
  request: typeof fetch = fetch,
): ImageObjectBucket {
  const config = readCloudBaseStorageConfig(env);
  if (!config) throw new Error("CLOUDBASE_STORAGE_NOT_CONFIGURED");
  const root = `https://${config.CLOUDBASE_ENV_ID}.api.tcloudbasegateway.com/v1/storages/object/${config.CLOUDBASE_STORAGE_BUCKET}/`;
  const send = async (key: string, method: string, bytes?: Uint8Array, contentType?: string) => {
    objectKeySchema.parse(key);
    const headers = new Headers({ Authorization: `Bearer ${config.CLOUDBASE_APIKEY}` });
    if (bytes) {
      headers.set("Content-Type", contentType ?? "application/octet-stream");
      headers.set("Content-Length", String(bytes.length));
      headers.set("x-upsert", "true");
    }
    try {
      const response = await request(root + key.split("/").map(encodeURIComponent).join("/"), {
        method,
        headers,
        ...(bytes ? { body: new Uint8Array(bytes) } : {}),
        signal: AbortSignal.timeout(30000),
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
  const objectSize = (response: Response, key: string) => {
    const size = Number(response.headers.get("Content-Length"));
    if (
      !Number.isSafeInteger(size) ||
      size < 1 ||
      size > (key.endsWith(".mp4") ? 128 * 1024 * 1024 : imageLimits.outputBytes)
    )
      throw new Error("IMAGE_STORAGE_UNAVAILABLE");
    return size;
  };
  return {
    async head(key) {
      const response = await send(key, "HEAD");
      if (!response) return null;
      return { size: objectSize(response, key), httpEtag: response.headers.get("ETag") ?? '""' };
    },
    async get(key) {
      const response = await send(key, "GET");
      if (!response) return null;
      try {
        const size = objectSize(response, key);
        if (!response.body) throw new Error("IMAGE_STORAGE_UNAVAILABLE");
        return {
          size,
          httpEtag: response.headers.get("ETag") ?? undefined,
          body: response.body,
          arrayBuffer: () => response.arrayBuffer(),
        };
      } catch {
        await response.body?.cancel();
        throw new Error("IMAGE_STORAGE_UNAVAILABLE");
      }
    },
    async put(key, bytes, options) {
      if (!bytes.length || bytes.length > imageLimits.outputBytes)
        throw new Error("INVALID_IMAGE_SIZE");
      // sha256 remains authoritative in media_assets; pgstore owns its system metadata.
      const response = await send(key, "PUT", bytes, options?.httpMetadata?.contentType);
      if (!response) throw new Error("IMAGE_STORAGE_UNAVAILABLE");
      await response.body?.cancel();
      return { stored: true };
    },
    async delete(keys) {
      for (const key of typeof keys === "string" ? [keys] : keys) {
        const response = await send(key, "DELETE");
        await response?.body?.cancel();
      }
    },
  };
}

/** PG signed download API; call only after validating the application's download capability. */
export function cloudbaseDownloadSigner(
  env: CloudBaseStorageBindings,
  request: typeof fetch = fetch,
) {
  const config = readCloudBaseStorageConfig(env);
  if (!config) throw new Error("CLOUDBASE_STORAGE_NOT_CONFIGURED");
  const origin = `https://${config.CLOUDBASE_ENV_ID}.api.tcloudbasegateway.com`;
  return async (key: string, expiresIn: number) => {
    objectKeySchema.parse(key);
    if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 300)
      throw new Error("INVALID_DOWNLOAD_LIFETIME");
    const pathname = `/v1/storages/object/sign/${config.CLOUDBASE_STORAGE_BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`;
    try {
      const response = await request(origin + pathname, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.CLOUDBASE_APIKEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expiresIn }),
        signal: AbortSignal.timeout(10000),
        redirect: "manual",
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error("IMAGE_STORAGE_UNAVAILABLE");
      }
      const parsed = z
        .object({ fullSignedURL: z.string().max(16384) })
        .parse(await response.json());
      const url = new URL(parsed.fullSignedURL);
      // Only redirect to this environment's exact signed object, never an arbitrary upstream URL.
      if (
        url.origin !== origin ||
        url.pathname !== pathname ||
        url.username ||
        url.password ||
        url.hash ||
        !url.searchParams.get("token")
      )
        throw new Error("IMAGE_STORAGE_UNAVAILABLE");
      url.searchParams.set("download", key.split("/").at(-1) ?? "image.png");
      return url.href;
    } catch {
      throw new Error("IMAGE_STORAGE_UNAVAILABLE");
    }
  };
}
