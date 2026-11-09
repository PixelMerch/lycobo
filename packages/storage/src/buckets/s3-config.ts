import { z } from "zod";

export interface S3Bindings {
  S3_ENDPOINT?: string;
  S3_BUCKET?: string;
  S3_REGION?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_SESSION_TOKEN?: string;
  S3_FORCE_PATH_STYLE?: string;
  S3_REQUEST_TIMEOUT_MS?: string;
  S3_PUBLIC_BASE_URL?: string;
}
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]", "image-storage", "model-storage"]);
const storageUrl = z.url().refine((value) => {
  const url = new URL(value);
  return (
    (url.protocol === "https:" || (url.protocol === "http:" && localHosts.has(url.hostname))) &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash
  );
});
const schema = z.object({
  S3_ENDPOINT: storageUrl.refine((value) => new URL(value).pathname === "/"),
  S3_BUCKET: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/),
  S3_REGION: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_SESSION_TOKEN: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).optional(),
  ),
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  S3_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(20000),
  S3_PUBLIC_BASE_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    storageUrl.optional(),
  ),
});
/** Server-only, provider-neutral configuration. Partial settings fail instead of switching stores. */
export function readS3Config(env: S3Bindings) {
  if (
    ![
      env.S3_ENDPOINT,
      env.S3_BUCKET,
      env.S3_ACCESS_KEY_ID,
      env.S3_SECRET_ACCESS_KEY,
      env.S3_SESSION_TOKEN,
      env.S3_PUBLIC_BASE_URL,
    ].some(Boolean)
  )
    return;
  const result = schema.safeParse(env);
  if (!result.success) throw new Error("INVALID_S3_CONFIGURATION");
  if (
    !result.data.S3_FORCE_PATH_STYLE &&
    (result.data.S3_BUCKET.includes(".") ||
      /^[\d.]+$/.test(new URL(result.data.S3_ENDPOINT).hostname) ||
      new URL(result.data.S3_ENDPOINT).hostname.startsWith("["))
  )
    throw new Error("INVALID_S3_CONFIGURATION");
  return result.data;
}
export type S3Config = NonNullable<ReturnType<typeof readS3Config>>;

/** Endpoint is the service origin; neither a bucket hostname nor a CDN URL. */
export function s3ObjectUrl(config: S3Config, key: string) {
  if (
    !key ||
    key.startsWith("/") ||
    key.includes("\\") ||
    key.split("/").some((part) => !part || part === "." || part === "..") ||
    Array.from(key).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    throw new Error("INVALID_OBJECT_KEY");
  const url = new URL(config.S3_ENDPOINT);
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  if (config.S3_FORCE_PATH_STYLE) url.pathname = `/${config.S3_BUCKET}/${encoded}`;
  else {
    url.hostname = `${config.S3_BUCKET}.${url.hostname}`;
    url.pathname = `/${encoded}`;
  }
  return url;
}
