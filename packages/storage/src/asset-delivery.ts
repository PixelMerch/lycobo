const encoder = new TextEncoder();
export const assetLinkLifetime = 86400;
export const assetDownloadLifetime = 1800;
// Covers a paused clip; kept short because a platform link skips application origin checks.
export const assetPlaybackLifetime = 900;
// Links issued within the same window share their expiry, so a reload or refetch yields the same
// URL and the browser reuses its cached image instead of fetching it again through the function.
export const assetLinkWindow = 900;
export const assetKeyPattern = /^[0-9]{10}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|mp4)$/;
export type AssetVariant = "preview" | "thumbnail" | "download" | "provider";
const message = (key: string, expires: number, variant: AssetVariant) =>
  encoder.encode(`lycobo-asset-v2\n${key}\n${expires}\n${variant}`);
export async function assetSigningKey(secret: string) {
  if (secret.length < 32) throw new Error("ASSET_SIGNING_NOT_CONFIGURED");
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
export async function signAsset(
  key: string,
  expires: number,
  signingKey: Awaited<ReturnType<typeof assetSigningKey>>,
  variant: AssetVariant = "preview",
) {
  if (!assetKeyPattern.test(key)) throw new Error("INVALID_ASSET_KEY");
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", signingKey, message(key, expires, variant)),
  );
  return btoa(String.fromCharCode(...signature))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
export async function verifyAsset(
  key: string,
  expires: number,
  signature: string,
  signingKey: Awaited<ReturnType<typeof assetSigningKey>>,
  now = Math.floor(Date.now() / 1000),
  variant: AssetVariant = "preview",
) {
  if (
    !assetKeyPattern.test(key) ||
    !Number.isSafeInteger(expires) ||
    expires <= now ||
    expires >
      now +
        (variant === "download" ? assetDownloadLifetime + assetLinkWindow : assetLinkLifetime) ||
    !/^[\w-]{43}$/.test(signature)
  )
    return false;
  const bytes = Uint8Array.from(
    atob(signature.replaceAll("-", "+").replaceAll("_", "/") + "="),
    (c) => c.charCodeAt(0),
  );
  return crypto.subtle.verify("HMAC", signingKey, bytes, message(key, expires, variant));
}
export function assetDeliverySigner(
  origin: string,
  secret: string,
  options: { allowLocalHttp?: boolean; pathPrefix?: string } = {},
) {
  const base = new URL(origin);
  const prefix = options.pathPrefix ?? "/";
  if (!/^\/(?:[a-z0-9_-]+\/)*$/.test(prefix)) throw new Error("INVALID_ASSET_PREFIX");
  if (
    (base.protocol !== "https:" &&
      !(
        options.allowLocalHttp &&
        base.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]", "cdn.lycobo.localhost"].includes(base.hostname)
      )) ||
    base.pathname !== "/" ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw new Error("INVALID_ASSET_ORIGIN");
  const signingKey = assetSigningKey(secret);
  return async (key: string) => {
    // Preview lifetime is at most 24 hours; preserve the short attachment capability.
    const previewExpires =
      Math.floor(Math.floor(Date.now() / 1000) / assetLinkWindow) * assetLinkWindow +
      assetLinkLifetime;
    const expires_at =
      Math.ceil((Math.floor(Date.now() / 1000) + assetDownloadLifetime) / assetLinkWindow) *
      assetLinkWindow;
    const variant = async (value: AssetVariant) => {
      // Videos are played as stored; the cover is their only derived object.
      const pathname = key.endsWith(".mp4")
        ? value === "thumbnail"
          ? `${key}.thumbnail.webp`
          : key
        : value === "download"
          ? key
          : key.replace(/\.png$/, `.${value}.webp`);
      const url = new URL(`${prefix}${pathname}`, base);
      const expires = value === "download" ? expires_at : previewExpires;
      url.searchParams.set("expires", String(expires));
      url.searchParams.set("variant", value);
      url.searchParams.set("sig", await signAsset(key, expires, await signingKey, value));
      return url.href;
    };
    return {
      url: await variant("preview"),
      thumbnail_url: await variant("thumbnail"),
      download_url: await variant("download"),
      // Keep the envelope expiry at the shortest capability for older web clients.
      expires_at,
    };
  };
}

/** Only the worker issues this raw-image capability; it requires no browser headers. */
export function providerReferenceSigner(origin: string, secret: string, prefix = "/") {
  const base = new URL(origin);
  if (
    base.protocol !== "https:" ||
    base.pathname !== "/" ||
    base.username ||
    base.password ||
    !/^\/(?:[a-z0-9_-]+\/)*$/.test(prefix)
  )
    throw new Error("INVALID_ASSET_ORIGIN");
  const signingKey = assetSigningKey(secret);
  return async (key: string) => {
    if (!key.endsWith(".png")) throw new Error("INVALID_REFERENCE");
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const url = new URL(prefix + key, base);
    url.searchParams.set("expires", String(expires));
    url.searchParams.set("variant", "provider");
    url.searchParams.set("sig", await signAsset(key, expires, await signingKey, "provider"));
    return url.href;
  };
}
