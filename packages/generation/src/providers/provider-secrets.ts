// 加密密钥由运行环境提供，PostgreSQL 保存密文。
const bytes = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
const encoded = (value: Uint8Array) => btoa(String.fromCharCode(...value));
async function key(secret: string) {
  const raw = bytes(secret);
  if (raw.length !== 32) throw new Error("MODEL_SECRET_KEY_INVALID");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
/** 使用 AES-GCM 封装凭据，可将密文绑定到指定用途和归属。 */
export async function sealProviderKey(value: string, secret: string, context?: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, ...(context && { additionalData: new TextEncoder().encode(context) }) },
    await key(secret),
    new TextEncoder().encode(value),
  );
  return `v1.${encoded(iv)}.${encoded(new Uint8Array(cipher))}`;
}
/** 解开 AES-GCM 凭据，绑定上下文的密文必须使用同一上下文。 */
export async function openProviderKey(value: string, secret: string, context?: string) {
  const [version, iv, cipher] = value.split(".");
  if (version !== "v1" || !iv || !cipher) throw new Error("MODEL_SECRET_INVALID");
  const plain = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: bytes(iv),
      ...(context && { additionalData: new TextEncoder().encode(context) }),
    },
    await key(secret),
    bytes(cipher),
  );
  return new TextDecoder().decode(plain);
}
