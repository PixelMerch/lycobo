import { assetKeyPattern, assetSigningKey, verifyAsset } from "./asset-delivery";
import { displayObjectKey } from "./image-variants";
import type { ImageObjectBucket } from "./object-bucket";

export interface PrivateAssetOptions {
  bucket: ImageObjectBucket;
  signingSecret: string;
  allowedOrigins: string;
  createVariant?: (
    body: ReadableStream<Uint8Array>,
    variant: "preview" | "thumbnail",
  ) => Promise<Uint8Array>;
  cache?: {
    match(request: Request): Promise<Response | undefined>;
    put(request: Request, response: Response): Promise<void>;
  };
  background?: (work: Promise<void>) => void;
}
/** Check scoped capability and browser origin before any object or cache access. */
export async function servePrivateAsset(request: Request, options: PrivateAssetOptions) {
  const { bucket } = options;
  const fail = (status: number) =>
    new Response(null, { status, headers: { "Cache-Control": "no-store" } });
  if (!["GET", "HEAD"].includes(request.method)) return fail(405);
  if (!options.signingSecret || !options.allowedOrigins) return fail(503);
  const url = new URL(request.url);
  const requestedKey = url.pathname.slice(1);
  const pathVariant = requestedKey.endsWith(".thumbnail.webp")
    ? "thumbnail"
    : requestedKey.endsWith(".preview.webp")
      ? "preview"
      : undefined;
  const key = pathVariant
    ? requestedKey.replace(/\.(preview|thumbnail)\.webp$/, ".png")
    : requestedKey;
  const expires = Number(url.searchParams.get("expires"));
  const variant = url.searchParams.get("variant") ?? pathVariant ?? "preview";
  if (
    !assetKeyPattern.test(key) ||
    !["preview", "thumbnail", "download"].includes(variant) ||
    (pathVariant && variant !== pathVariant)
  )
    return fail(403);
  if (variant === "download" && request.headers.get("Sec-Fetch-Dest") === "image") return fail(403);
  const allowed = options.allowedOrigins.split(",").map((value) => value.trim());
  // Require a trusted browser source in addition to the scoped signed capability.
  if (!request.headers.get("Origin") && !request.headers.get("Referer")) return fail(403);
  for (const value of [request.headers.get("Origin"), request.headers.get("Referer")]) {
    if (!value) continue;
    try {
      if (!allowed.includes(new URL(value).origin)) return fail(403);
    } catch {
      return fail(403);
    }
  }
  if (
    !(await verifyAsset(
      key,
      expires,
      url.searchParams.get("sig") ?? "",
      await assetSigningKey(options.signingSecret),
      Math.floor(Date.now() / 1000),
      variant === "download" ? "download" : variant === "thumbnail" ? "thumbnail" : "preview",
    ))
  )
    return fail(403);
  // Authenticate before every cache lookup. Signatures never fragment the object cache.
  const displayVariant = variant === "thumbnail" ? "thumbnail" : "preview";
  const objectKey = variant === "download" ? key : displayObjectKey(key, displayVariant);
  const cacheUrl = new URL(`/_objects/${objectKey}`, url.origin);
  const cacheKey = new Request(cacheUrl);
  let response = await options.cache?.match(cacheKey);
  const hit = !!response;
  if (!response) {
    let object = await bucket.head(objectKey);
    // Existing assets are backfilled once after authorization, never by recalling a model.
    if (!object && variant !== "download" && options.createVariant) {
      const original = await bucket.get(key);
      if (!original) return fail(404);
      const resized = await options.createVariant(original.body, displayVariant);
      await bucket.put(objectKey, resized, {
        httpMetadata: { contentType: "image/webp" },
      });
      object = await bucket.head(objectKey);
    }
    if (!object) return fail(404);
    let body: ReadableStream | null = null;
    if (request.method !== "HEAD") {
      const found = await bucket.get(objectKey);
      if (!found) return fail(404);
      body = found.body;
    }
    const headers = new Headers({
      "Content-Type": variant === "download" ? "image/png" : "image/webp",
      "Content-Length": String(object.size),
      ETag: object.httpEtag,
      "Cache-Control": "public, max-age=86400",
    });
    response = new Response(body, { headers });
    if (request.method === "GET" && options.cache && options.background)
      options.background(
        options.cache.put(cacheKey, response.clone()).catch(() => {
          console.error("ASSET_CACHE_WRITE_FAILED");
        }),
      );
  }
  const headers = new Headers(response.headers);
  headers.set(
    "Cache-Control",
    variant === "download"
      ? "private, no-store"
      : `private, max-age=${Math.max(0, expires - Math.floor(Date.now() / 1000))}, immutable`,
  );
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Asset-Cache", hit ? "HIT" : "MISS");
  headers.set(
    "Content-Disposition",
    `${variant === "download" ? "attachment" : "inline"}; filename="${objectKey.split("/").at(-1)}"`,
  );
  const origin = request.headers.get("Origin");
  if (origin && allowed.includes(origin)) headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Vary", "Origin, Referer, Sec-Fetch-Dest");
  if (request.headers.get("If-None-Match") === headers.get("ETag")) {
    headers.delete("Content-Length");
    return new Response(null, { status: 304, headers });
  }
  return new Response(request.method === "HEAD" ? null : response.body, { headers });
}
