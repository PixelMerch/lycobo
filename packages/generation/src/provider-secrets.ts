// AES-GCM keys live only in Worker Secrets; immutable ciphertext versions stay in PostgreSQL.
const bytes = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
const encoded = (value: Uint8Array) => btoa(String.fromCharCode(...value));
async function key(secret: string) {
  const raw = bytes(secret);
  if (raw.length !== 32) throw new Error("MODEL_SECRET_KEY_INVALID");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function sealProviderKey(value: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await key(secret),
    new TextEncoder().encode(value),
  );
  return `v1.${encoded(iv)}.${encoded(new Uint8Array(cipher))}`;
}
export async function openProviderKey(value: string, secret: string) {
  const [version, iv, cipher] = value.split(".");
  if (version !== "v1" || !iv || !cipher) throw new Error("MODEL_SECRET_INVALID");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes(iv) },
    await key(secret),
    bytes(cipher),
  );
  return new TextDecoder().decode(plain);
}
