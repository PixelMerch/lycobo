import { expect, it, vi } from "vitest";
import { assetDeliverySigner } from "./asset-delivery";
import { servePrivateAsset } from "./private-asset-server";

it("enqueues missing variants only after signature/source validation and never during HEAD", async () => {
  const key = `1234567890/${crypto.randomUUID()}/${crypto.randomUUID()}.png`;
  const secret = "fixture-private-asset-queue-secret-0001";
  const links = await assetDeliverySigner("https://media.example.test", secret)(key);
  const bucket = {
    get: vi.fn(async () => null),
    head: vi.fn(async () => null),
    put: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  };
  const queueVariant = vi.fn(async (_key: string) => undefined);
  const options = {
    bucket,
    signingSecret: secret,
    allowedOrigins: "https://app.example.test",
    queueVariant,
  };
  const forged = new URL(links.url);
  forged.searchParams.set("sig", "bad");
  expect(
    (
      await servePrivateAsset(
        new Request(forged, { headers: { Origin: "https://app.example.test" } }),
        options,
      )
    ).status,
  ).toBe(403);
  expect((await servePrivateAsset(new Request(links.url), options)).status).toBe(403);
  expect(bucket.get).not.toHaveBeenCalled();
  expect(queueVariant).not.toHaveBeenCalled();
  await servePrivateAsset(
    new Request(links.url, { method: "HEAD", headers: { Origin: "https://app.example.test" } }),
    options,
  );
  expect(queueVariant).not.toHaveBeenCalled();
  const response = await servePrivateAsset(
    new Request(links.url, { headers: { Origin: "https://app.example.test" } }),
    options,
  );
  expect(response.status).toBe(503);
  expect(response.headers.get("Retry-After")).toBe("2");
  expect(queueVariant).toHaveBeenCalledExactlyOnceWith(key);
  expect(bucket.put).not.toHaveBeenCalled();
});
