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
  signDownload?: (key: string, expiresIn: number) => Promise<string>;
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
    !["preview", "thumbnail", "download", "provider"].includes(variant) ||
    (pathVariant && variant !== pathVariant)
  )
    return fail(403);
  if (variant === "download" && request.headers.get("Sec-Fetch-Dest") === "image") return fail(403);
  const allowed = options.allowedOrigins.split(",").map((value) => value.trim());
  // Require a trusted browser source in addition to the scoped signed capability.
  if (variant !== "provider" && !request.headers.get("Origin") && !request.headers.get("Referer"))
    return fail(403);
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
      variant === "provider"
        ? "provider"
        : variant === "download"
          ? "download"
          : variant === "thumbnail"
            ? "thumbnail"
            : "preview",
    ))
  )
    return fail(403);
  if (variant === "download" && request.method === "GET" && options.signDownload) {
    const location = await options.signDownload(
      key,
      Math.min(300, expires - Math.floor(Date.now() / 1000)),
    );
    const headers = new Headers({
      Location: location,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    });
    const origin = request.headers.get("Origin");
    if (origin && allowed.includes(origin)) headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin, Referer, Sec-Fetch-Dest");
    return new Response(null, { status: 302, headers });
  }
  if (key.endsWith(".mp4") || variant === "provider") {
    if (pathVariant || (variant === "provider" && !key.endsWith(".png"))) return fail(403);
    const object = request.method === "HEAD" ? await bucket.head(key) : await bucket.get(key);
    if (!object) return fail(404);
    const headers = new Headers({
      "Content-Type": key.endsWith(".mp4") ? "video/mp4" : "image/png",
      "Content-Length": String(object.size),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Accept-Ranges": "bytes",
      "Content-Disposition": `${variant === "download" ? "attachment" : "inline"}; filename="${key.split("/").at(-1)}"`,
    });
    const origin = request.headers.get("Origin");
    if (origin && allowed.includes(origin)) headers.set("Access-Control-Allow-Origin", origin);
    let body = "body" in object ? object.body : null;
    const range = request.headers.get("Range");
    if (range && key.endsWith(".mp4")) {
      const parsed = /^bytes=(\d+)-(\d*)$/.exec(range);
      const start = Number(parsed?.[1]),
        end = parsed?.[2] ? Number(parsed[2]) : object.size - 1;
      if (
        !parsed ||
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start > end ||
        start >= object.size ||
        end >= object.size
      ) {
        await body?.cancel();
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${object.size}` },
        });
      }
      headers.set("Content-Range", `bytes ${start}-${end}/${object.size}`);
      headers.set("Content-Length", String(end - start + 1));
      let offset = 0;
      body =
        body?.pipeThrough(
          new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
              const left = Math.max(0, start - offset),
                right = Math.min(chunk.length, end + 1 - offset);
              if (right > left) controller.enqueue(chunk.subarray(left, right));
              offset += chunk.length;
              if (offset > end) controller.terminate();
            },
          }),
        ) ?? null;
      return new Response(body, { status: 206, headers });
    }
    return new Response(body, { headers });
  }
  // Authenticate before every cache lookup. Signatures never fragment the object cache.
  const displayVariant = variant === "thumbnail" ? "thumbnail" : "preview";
  const objectKey = variant === "download" ? key : displayObjectKey(key, displayVariant);
  const cacheUrl = new URL(`/_objects/${objectKey}`, url.origin);
  const cacheKey = new Request(cacheUrl);
  let response = await options.cache?.match(cacheKey);
  const hit = !!response;
  if (!response) {
    const readObject = () =>
      request.method === "HEAD" ? bucket.head(objectKey) : bucket.get(objectKey);
    let object = await readObject();
    // Existing assets are backfilled once after authorization, never by recalling a model.
    if (!object && request.method === "GET" && variant !== "download" && options.createVariant) {
      const original = await bucket.get(key);
      if (!original) return fail(404);
      const resized = await options.createVariant(original.body, displayVariant);
      await bucket.put(objectKey, resized, {
        httpMetadata: { contentType: "image/webp" },
      });
      object = await readObject();
    }
    if (!object) return fail(404);
    const body = "body" in object ? object.body : null;
    const headers = new Headers({
      "Content-Type": variant === "download" ? "image/png" : "image/webp",
      "Content-Length": String(object.size),
      "Cache-Control": "public, max-age=86400",
    });
    if (object.httpEtag) headers.set("ETag", object.httpEtag);
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
  if (headers.has("ETag") && request.headers.get("If-None-Match") === headers.get("ETag")) {
    headers.delete("Content-Length");
    await response.body?.cancel();
    return new Response(null, { status: 304, headers });
  }
  return new Response(request.method === "HEAD" ? null : response.body, { headers });
}
