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
    expect(new URL(links.url).pathname).toBe(`/${key.replace(/\.png$/, ".preview.webp")}`);
    expect(new URL(links.thumbnail_url).searchParams.get("variant")).toBe("thumbnail");
    expect(new URL(links.download_url).searchParams.get("variant")).toBe("download");
    expect(JSON.stringify(links)).not.toContain(secret);
    expect(() => assetDeliverySigner("http://assets.example.test", secret)).toThrow();
  });
});

it("allows HTTP only through explicit development opt-in on exact loopback hosts", async () => {
  expect(() => assetDeliverySigner("http://localhost:8791", secret)).toThrow();
  const local = await assetDeliverySigner("http://localhost:8791", secret, {
    allowLocalHttp: true,
  })(key);
  expect(new URL(local.url).origin).toBe("http://localhost:8791");
  for (const origin of [
    "http://assets.example.test",
    "http://localhost.evil.test",
    "http://127.0.0.1.evil.test",
    "ftp://localhost:8791",
  ])
    expect(() => assetDeliverySigner(origin, secret, { allowLocalHttp: true })).toThrow();
});

it("signs a compressed preview by default and preserves the original only for download", async () => {
  const links = await assetDeliverySigner("http://cdn.lycobo.localhost:8791", secret, {
    allowLocalHttp: true,
  })(key);
  expect(new URL(links.url).searchParams.get("variant")).toBe("preview");
  expect(new URL(links.thumbnail_url).searchParams.get("variant")).toBe("thumbnail");
  expect(new URL(links.download_url).searchParams.get("variant")).toBe("download");
  expect(() =>
    assetDeliverySigner("http://cdn.lycobo.localhost.evil.test", secret, { allowLocalHttp: true }),
  ).toThrow();
});

it("binds each signature to its variant so preview capabilities cannot retrieve originals", async () => {
  const signing = await assetSigningKey(secret);
  const expires = Math.floor(Date.now() / 1000) + 1800;
  const preview = await signAsset(key, expires, signing, "preview");
  const download = await signAsset(key, expires, signing, "download");
  expect(preview).not.toBe(download);
  expect(await verifyAsset(key, expires, preview, signing, undefined, "download")).toBe(false);
  expect(await verifyAsset(key, expires, download, signing, undefined, "download")).toBe(true);
});
