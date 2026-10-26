const encoder = new TextEncoder();
export const assetLinkLifetime = 1800;
export const assetKeyPattern = /^[0-9]{10}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/;
const message = (key: string, expires: number) =>
  encoder.encode(`lycobo-asset-v1\n${key}\n${expires}`);
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
export async function signAsset(key: string, expires: number, signingKey: CryptoKey) {
  if (!assetKeyPattern.test(key)) throw new Error("INVALID_ASSET_KEY");
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", signingKey, message(key, expires)),
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
  signingKey: CryptoKey,
  now = Math.floor(Date.now() / 1000),
) {
  if (
    !assetKeyPattern.test(key) ||
    !Number.isSafeInteger(expires) ||
    expires <= now ||
    expires > now + assetLinkLifetime ||
    !/^[\w-]{43}$/.test(signature)
  )
    return false;
  const bytes = Uint8Array.from(
    atob(signature.replaceAll("-", "+").replaceAll("_", "/") + "="),
    (c) => c.charCodeAt(0),
  );
  return crypto.subtle.verify("HMAC", signingKey, bytes, message(key, expires));
}
export function assetDeliverySigner(
  origin: string,
  secret: string,
  options: { allowLocalHttp?: boolean } = {},
) {
  const base = new URL(origin);
  if (
    (base.protocol !== "https:" &&
      !(
        options.allowLocalHttp &&
        base.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)
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
    const expires_at = Math.floor(Date.now() / 1000) + assetLinkLifetime;
    const sig = await signAsset(key, expires_at, await signingKey);
    const url = new URL(`/${key}`, base);
    url.searchParams.set("expires", String(expires_at));
    url.searchParams.set("sig", sig);
    const variant = (value: string) => {
      const copy = new URL(url);
      copy.searchParams.set("variant", value);
      return copy.href;
    };
    return {
      url: url.href,
      thumbnail_url: variant("thumbnail"),
      download_url: variant("download"),
      expires_at,
    };
  };
}
