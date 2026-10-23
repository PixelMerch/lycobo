import { describe, expect, it } from "vitest";
import { assetDeliverySigner, assetSigningKey, signAsset, verifyAsset } from "./asset-delivery";

const key = `0057849613/${crypto.randomUUID()}/${crypto.randomUUID()}.png`;
const secret = "fixture-only-asset-signing-secret-0001";
describe("asset capabilities", () => {
  it("binds signatures to exact object keys and bounded expiry", async () => {
    const signing = await assetSigningKey(secret);
    const now = Math.floor(Date.now() / 1000);
    const expires = now + 1800;
    const sig = await signAsset(key, expires, signing);
    expect(await verifyAsset(key, expires, sig, signing, now)).toBe(true);
    expect(
      await verifyAsset(key.replace("0057849613", "1234567890"), expires, sig, signing, now),
    ).toBe(false);
    expect(await verifyAsset(key, expires + 1, sig, signing, now)).toBe(false);
    expect(await verifyAsset(key, expires, sig, signing, expires)).toBe(false);
    expect(await verifyAsset(key, expires, sig, signing, now - 1)).toBe(false);
    expect(await verifyAsset(key, expires, "bad", signing, now)).toBe(false);
    expect(await verifyAsset(`../${key}`, expires, sig, signing, now)).toBe(false);
  });
  it("issues separate original, thumbnail and attachment URLs without credentials", async () => {
    const links = await assetDeliverySigner("https://assets.example.test", secret)(key);
    expect(new URL(links.url).pathname).toBe(`/${key}`);
    expect(new URL(links.thumbnail_url).searchParams.get("variant")).toBe("thumbnail");
    expect(new URL(links.download_url).searchParams.get("variant")).toBe("download");
    expect(JSON.stringify(links)).not.toContain(secret);
    expect(() => assetDeliverySigner("http://assets.example.test", secret)).toThrow();
  });
});
