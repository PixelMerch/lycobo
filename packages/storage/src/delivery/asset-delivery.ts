const encoder = new TextEncoder();
export const assetLinkLifetime = 86400;
export const assetDownloadLifetime = 1800;
const agentAssetLifetime = 900;
// 短期播放签名覆盖视频暂停时间，平台直链不再检查应用来源。
export const assetPlaybackLifetime = 900;
// 同一时间窗口共享过期时间，重载时复用浏览器缓存。
export const assetLinkWindow = 900;
export const assetKeyPattern = /^[0-9]{10}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|webp|mp4)$/;
export type AssetVariant =
  | "preview"
  | "thumbnail"
  | "download"
  | "provider"
  | "agent-preview"
  | "agent-download";

/** 识别由已鉴权的 Agent 查询签发的短期图片链接。 */
export const isAgentAssetVariant = (value: string) =>
  value === "agent-preview" || value === "agent-download";

function assetLifetime(variant: AssetVariant) {
  if (isAgentAssetVariant(variant)) return agentAssetLifetime;
  return variant === "download" ? assetDownloadLifetime + assetLinkWindow : assetLinkLifetime;
}
const message = (key: string, expires: number, variant: AssetVariant) =>
  encoder.encode(`lycobo-asset-v2\n${key}\n${expires}\n${variant}`);
/** 导入私有媒体签名使用的 HMAC 密钥。 */
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
/** 对对象、用途和过期时间一起签名，限制链接只能用于原用途。 */
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
/** 校验签名和对应媒体用途的最长有效时间。 */
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
    expires > now + assetLifetime(variant) ||
    !/^[\w-]{43}$/.test(signature)
  )
    return false;
  const bytes = Uint8Array.from(
    atob(signature.replaceAll("-", "+").replaceAll("_", "/") + "="),
    (c) => c.charCodeAt(0),
  );
  return crypto.subtle.verify("HMAC", signingKey, bytes, message(key, expires, variant));
}
function variantPath(key: string, variant: AssetVariant) {
  if (isAgentAssetVariant(variant)) return key;
  if (key.endsWith(".mp4")) return variant === "thumbnail" ? `${key}.thumbnail.webp` : key;
  return variant === "download" ? key : key.replace(/\.png$/, `.${variant}.webp`);
}

/** 为站内和经过授权的 Agent 结果生成不同用途的媒体地址。 */
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
  const signedUrl = async (key: string, variant: AssetVariant, expires: number) => {
    const url = new URL(`${prefix}${variantPath(key, variant)}`, base);
    url.searchParams.set("expires", String(expires));
    url.searchParams.set("variant", variant);
    url.searchParams.set("sig", await signAsset(key, expires, await signingKey, variant));
    return url.href;
  };
  return async (key: string, audience?: "agent") => {
    const now = Math.floor(Date.now() / 1000);
    if (audience === "agent") {
      if (!key.endsWith(".png")) throw new Error("INVALID_ASSET_KEY");
      const expires_at = now + agentAssetLifetime;
      const [preview, download] = await Promise.all([
        signedUrl(key, "agent-preview", expires_at),
        signedUrl(key, "agent-download", expires_at),
      ]);
      return { url: preview, thumbnail_url: preview, download_url: download, expires_at };
    }
    const previewExpires = Math.floor(now / assetLinkWindow) * assetLinkWindow + assetLinkLifetime;
    const expires_at = Math.ceil((now + assetDownloadLifetime) / assetLinkWindow) * assetLinkWindow;
    return {
      url: await signedUrl(key, "preview", previewExpires),
      thumbnail_url: await signedUrl(key, "thumbnail", previewExpires),
      download_url: await signedUrl(key, "download", expires_at),
      // 旧版网页使用同一个有效期，因此以最早到期的下载链接为准。
      expires_at,
    };
  };
}

/** 供应商链接只用 HTTPS 域名，且不携带浏览器或服务凭据。 */
export function isVideoReferenceUrl(value: string) {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return (
    url.protocol === "https:" &&
    /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*$/.test(url.hostname) &&
    !/\.(?:localhost|local|internal|test|invalid|example|onion)$/.test(url.hostname) &&
    !url.username &&
    !url.password &&
    !url.hash
  );
}

/** 从运行配置读取供应商参考图的公开服务地址。 */
export function videoReferenceOrigin(env: {
  VIDEO_REFERENCE_ORIGIN?: string;
  ASSET_PUBLIC_ORIGIN?: string;
}) {
  const value = env.VIDEO_REFERENCE_ORIGIN || env.ASSET_PUBLIC_ORIGIN;
  if (!value || !isVideoReferenceUrl(value)) return undefined;
  const url = new URL(value);
  return url.pathname === "/" && !url.search ? url.origin : undefined;
}

/** Worker 为供应商签发不依赖浏览器请求头的 PNG 或 WebP 参考图链接。 */
export function providerReferenceSigner(origin: string, secret: string, prefix = "/") {
  const publicOrigin = videoReferenceOrigin({ VIDEO_REFERENCE_ORIGIN: origin });
  if (!publicOrigin || !/^\/(?:[a-z0-9_-]+\/)*$/.test(prefix))
    throw new Error("INVALID_ASSET_ORIGIN");
  const signingKey = assetSigningKey(secret);
  return async (key: string) => {
    if (!key.endsWith(".png") && !key.endsWith(".webp")) throw new Error("INVALID_REFERENCE");
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const url = new URL(prefix + key, publicOrigin);
    url.searchParams.set("expires", String(expires));
    url.searchParams.set("variant", "provider");
    url.searchParams.set("sig", await signAsset(key, expires, await signingKey, "provider"));
    return url.href;
  };
}
