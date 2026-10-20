import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const derive = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt);
  return `scrypt-v1$${salt}$${key.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const match = /^scrypt-v1\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(stored);
  if (!match?.[1] || !match[2]) return false;
  const actual = await derive(password, match[1]);
  return timingSafeEqual(actual, Buffer.from(match[2], "hex"));
}
// Unknown accounts still perform the same password KDF, without startup secrets.
export const dummyPasswordHash = `scrypt-v1$${"0".repeat(32)}$${"0".repeat(128)}`;
