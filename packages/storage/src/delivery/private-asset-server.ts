import type { ImageObjectBucket } from "../buckets/object-bucket";
import { displayObjectKey } from "../images/image-variants";
import {
  type AssetVariant,
  assetKeyPattern,
  assetPlaybackLifetime,
  assetSigningKey,
  verifyAsset,
} from "./asset-delivery";

export interface PrivateAssetOptions {
  bucket: ImageObjectBucket;
  signingSecret: string;
  allowedOrigins: string;
  createVariant?: (
    body: ReadableStream<Uint8Array>,
    variant: "preview" | "thumbnail",
  ) => Promise<Uint8Array>;
  queueVariant?: (key: string) => Promise<void>;
  createVideoThumbnail?: (key: string) => Promise<void>;
  signDownload?: (key: string, expiresIn: number) => Promise<string>;
  /** Inline platform link: original videos exceed what a function response may carry. */
  signPlayback?: (key: string, expiresIn: number) => Promise<string>;
  cache?: {
    match(request: Request): Promise<Response | undefined>;
    put(request: Request, response: Response): Promise<void>;
  };
  background?: (work: Promise<void>) => void;
}
function fail(status: number) {
  return new Response(null, { status, headers: { "Cache-Control": "no-store" } });
}

function pathVariantFor(key: string): "preview" | "thumbnail" | undefined {
  if (key.endsWith(".thumbnail.webp")) return "thumbnail";
  return key.endsWith(".preview.webp") ? "preview" : undefined;
}

function requestAsset(url: URL) {
  const requestedKey = url.pathname.slice(1);
  const pathVariant = pathVariantFor(requestedKey);
  let key = requestedKey;
  if (key.endsWith(".mp4.thumbnail.webp")) key = key.replace(/\.thumbnail\.webp$/, "");
  else if (pathVariant) key = key.replace(/\.(preview|thumbnail)\.webp$/, ".png");
  const variant = url.searchParams.get("variant") ?? pathVariant ?? "preview";
  return { key, variant, pathVariant };
}

function isAssetVariant(value: string): value is AssetVariant {
  return ["preview", "thumbnail", "download", "provider"].includes(value);
}

function hasTrustedOrigin(request: Request, variant: AssetVariant, allowed: string[]) {
  const origin = request.headers.get("Origin");
  const referer = request.headers.get("Referer");
  // Browser requests also require a trusted origin or referrer.
  if (variant !== "provider" && !origin && !referer) return false;
  for (const value of [origin, referer]) {
    if (!value) continue;
    try {
      if (!allowed.includes(new URL(value).origin)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

function platformSigner(
  request: Request,
  key: string,
  variant: AssetVariant,
  options: PrivateAssetOptions,
) {
  if (request.method !== "GET") return undefined;
  if (variant === "download") return options.signDownload;
  if (variant === "preview" && key.endsWith(".mp4")) return options.signPlayback;
  return undefined;
}

function setOrigin(headers: Headers, request: Request, allowed: string[]) {
  const origin = request.headers.get("Origin");
  if (origin && allowed.includes(origin)) headers.set("Access-Control-Allow-Origin", origin);
}

type AuthorizedAsset = {
  key: string;
  variant: AssetVariant;
  pathVariant: ReturnType<typeof pathVariantFor>;
  expires: number;
  allowed: string[];
};

/** Check scoped capability and browser origin before any object or cache access. */
export async function servePrivateAsset(request: Request, options: PrivateAssetOptions) {
  if (!["GET", "HEAD"].includes(request.method)) return fail(405);
  if (!options.signingSecret || !options.allowedOrigins) return fail(503);
  const url = new URL(request.url);
  const { key, variant, pathVariant } = requestAsset(url);
  const expires = Number(url.searchParams.get("expires"));
  if (
    !assetKeyPattern.test(key) ||
    !isAssetVariant(variant) ||
    (pathVariant && variant !== pathVariant)
  )
    return fail(403);
  if (variant === "download" && request.headers.get("Sec-Fetch-Dest") === "image") return fail(403);
  const allowed = options.allowedOrigins.split(",").map((value) => value.trim());
  if (!hasTrustedOrigin(request, variant, allowed)) return fail(403);
  if (
    !(await verifyAsset(
      key,
      expires,
      url.searchParams.get("sig") ?? "",
      await assetSigningKey(options.signingSecret),
      Math.floor(Date.now() / 1000),
      variant,
    ))
  )
    return fail(403);
  const signPlatformLink = platformSigner(request, key, variant, options);
  if (signPlatformLink) {
    return redirectAsset(request, signPlatformLink, {
      key,
      variant,
      pathVariant,
      expires,
      allowed,
    });
  }
  const asset = { key, variant, pathVariant, expires, allowed };
  if (key.endsWith(".mp4") || variant === "provider") return serveOriginal(request, options, asset);
  return serveImage(request, options, asset, url.origin);
}

async function redirectAsset(
  request: Request,
  signPlatformLink: NonNullable<PrivateAssetOptions["signDownload"]>,
  { key, variant, expires, allowed }: AuthorizedAsset,
) {
  const location = await signPlatformLink(
    key,
    Math.min(
      variant === "download" ? 300 : assetPlaybackLifetime,
      expires - Math.floor(Date.now() / 1000),
    ),
  );
  const headers = new Headers({
    Location: location,
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
  });
  setOrigin(headers, request, allowed);
  headers.set("Vary", "Origin, Referer, Sec-Fetch-Dest");
  return new Response(null, { status: 302, headers });
}

async function serveMediaRange(
  body: ReadableStream<Uint8Array> | null,
  range: string,
  size: number,
  headers: Headers,
) {
  const parsed = /^bytes=(\d+)-(\d*)$/.exec(range);
  const start = Number(parsed?.[1]),
    end = parsed?.[2] ? Number(parsed[2]) : size - 1;
  if (
    !parsed ||
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start > end ||
    start >= size ||
    end >= size
  ) {
    await body?.cancel();
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${size}` },
    });
  }
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Content-Length", String(end - start + 1));
  let offset = 0;
  const rangedBody =
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
  return new Response(rangedBody, { status: 206, headers });
}

async function readOriginal(
  request: Request,
  options: PrivateAssetOptions,
  key: string,
  videoCover: boolean,
) {
  const objectKey = videoCover ? `${key}.thumbnail.webp` : key;
  if (request.method === "HEAD") return options.bucket.head(objectKey);
  const object = await options.bucket.get(objectKey);
  if (object || !videoCover || !options.createVideoThumbnail) return object;
  await options.createVideoThumbnail(key);
  return options.bucket.get(objectKey);
}

async function serveOriginal(
  request: Request,
  options: PrivateAssetOptions,
  asset: AuthorizedAsset,
) {
  const { key, variant, pathVariant, expires, allowed } = asset;
  const video = key.endsWith(".mp4");
  if ((variant === "provider" && !key.endsWith(".png")) || (pathVariant && !video))
    return fail(403);
  const videoCover = video && variant === "thumbnail";
  const originalType = video ? "video/mp4" : "image/png";
  const object = await readOriginal(request, options, key, videoCover);
  if (!object) return fail(404);
  const headers = new Headers({
    "Content-Type": videoCover ? "image/webp" : originalType,
    "Content-Length": String(object.size),
    "Cache-Control":
      key.endsWith(".mp4") && variant !== "download"
        ? `private, max-age=${Math.max(0, expires - Math.floor(Date.now() / 1000))}, immutable`
        : "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    "Content-Disposition": `${variant === "download" ? "attachment" : "inline"}; filename="${key.split("/").at(-1)}"`,
  });
  setOrigin(headers, request, allowed);
  const body = "body" in object ? object.body : null;
  const range = request.headers.get("Range");
  if (range && key.endsWith(".mp4") && !videoCover) {
    return serveMediaRange(body, range, object.size, headers);
  }
  return new Response(body, { headers });
}

async function readImageObject(
  request: Request,
  options: PrivateAssetOptions,
  key: string,
  objectKey: string,
  variant: AssetVariant,
) {
  const { bucket } = options;
  if (request.method === "HEAD") return bucket.head(objectKey);
  const object = await bucket.get(objectKey);
  if (object || variant === "download") return object;
  if (options.queueVariant) return null;
  if (!options.createVariant) return object;
  // 通过预览授权后才补建缺失的展示图。
  const original = await bucket.get(key);
  if (!original) return null;
  const resized = await options.createVariant(
    original.body,
    variant === "thumbnail" ? "thumbnail" : "preview",
  );
  await bucket.put(objectKey, resized, { httpMetadata: { contentType: "image/webp" } });
  return bucket.get(objectKey);
}

async function serveMissingVariant(
  request: Request,
  options: PrivateAssetOptions,
  { key, allowed }: AuthorizedAsset,
) {
  const head = request.method === "HEAD";
  const original = head ? await options.bucket.head(key) : await options.bucket.get(key);
  if (!original)
    return new Response(null, {
      status: 503,
      headers: { "Retry-After": "2", "Cache-Control": "no-store" },
    });
  if (!head && options.queueVariant) {
    const repair = queueVariantRepair(request, options, key).catch(() => {
      console.warn("ASSET_VARIANT_QUEUE_UNAVAILABLE");
    });
    if (options.background) options.background(repair);
    else await repair;
  }
  // 一直沿用本次预览签名和来源校验，原图回退不占用派生图缓存。
  const headers = new Headers({
    "Content-Type": "image/png",
    "Content-Length": String(original.size),
    "Content-Disposition": "inline",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    Vary: "Origin, Referer, Sec-Fetch-Dest",
  });
  setOrigin(headers, request, allowed);
  return new Response("body" in original ? original.body : null, { headers });
}

async function queueVariantRepair(request: Request, options: PrivateAssetOptions, key: string) {
  const marker = new Request(new URL(`/_asset-repair/${key}`, request.url));
  if (await options.cache?.match(marker).catch(() => undefined)) return;
  await options.queueVariant?.(key);
  // 同一素材的两个展示变体共用短期标记；仅入队成功后写入，缓存不可用时仍可恢复。
  await options.cache
    ?.put(marker, new Response(null, { headers: { "Cache-Control": "public, max-age=30" } }))
    .catch(() => undefined);
}

function cacheImageResponse(
  request: Request,
  options: PrivateAssetOptions,
  cacheKey: Request,
  variant: AssetVariant,
  object: NonNullable<Awaited<ReturnType<typeof readImageObject>>>,
) {
  const body = "body" in object ? object.body : null;
  const headers = new Headers({
    "Content-Type": variant === "download" ? "image/png" : "image/webp",
    "Content-Length": String(object.size),
    "Cache-Control": "public, max-age=86400",
  });
  if (object.httpEtag) headers.set("ETag", object.httpEtag);
  const response = new Response(body, { headers });
  if (request.method === "GET" && options.cache && options.background)
    options.background(
      options.cache.put(cacheKey, response.clone()).catch(() => {
        console.error("ASSET_CACHE_WRITE_FAILED");
      }),
    );
  return response;
}

async function serveImage(
  request: Request,
  options: PrivateAssetOptions,
  asset: AuthorizedAsset,
  requestOrigin: string,
) {
  const { key, variant, expires, allowed } = asset;
  // 每次读缓存前验证签名，同一对象的不同签名共用缓存。
  const displayVariant = variant === "thumbnail" ? "thumbnail" : "preview";
  const objectKey = variant === "download" ? key : displayObjectKey(key, displayVariant);
  const cacheUrl = new URL(`/_objects/${objectKey}`, requestOrigin);
  const cacheKey = new Request(cacheUrl);
  let response = await options.cache?.match(cacheKey);
  const hit = !!response;
  if (!response) {
    const object = await readImageObject(request, options, key, objectKey, variant);
    if (!object) {
      if (options.queueVariant && variant !== "download")
        return serveMissingVariant(request, options, asset);
      return fail(404);
    }
    response = cacheImageResponse(request, options, cacheKey, variant, object);
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
  setOrigin(headers, request, allowed);
  headers.set("Vary", "Origin, Referer, Sec-Fetch-Dest");
  if (headers.has("ETag") && request.headers.get("If-None-Match") === headers.get("ETag")) {
    headers.delete("Content-Length");
    await response.body?.cancel();
    return new Response(null, { status: 304, headers });
  }
  return new Response(request.method === "HEAD" ? null : response.body, { headers });
}
