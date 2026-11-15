import { expect, it, vi } from "vitest";
import { assetDeliverySigner } from "./asset-delivery";
import { type PrivateAssetOptions, servePrivateAsset } from "./private-asset-server";

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
  expect(queueVariant).not.toHaveBeenCalled();
  expect(bucket.put).not.toHaveBeenCalled();
});

it("reuses a successfully queued repair for the same asset across preview and thumbnail", async () => {
  const key = `1234567890/${crypto.randomUUID()}/${crypto.randomUUID()}.png`;
  const secret = "fixture-private-asset-queue-secret-0001";
  const links = await assetDeliverySigner("https://media.example.test", secret)(key);
  const responses = new Map<string, Response>();
  const queueVariant = vi
    .fn<NonNullable<PrivateAssetOptions["queueVariant"]>>()
    .mockRejectedValueOnce(new Error("QUEUE_TEMPORARILY_UNAVAILABLE"))
    .mockResolvedValue(undefined);
  const options: PrivateAssetOptions = {
    bucket: {
      get: async (objectKey) =>
        objectKey === key
          ? {
              size: 0,
              body: new ReadableStream({ start: (controller) => controller.close() }),
              arrayBuffer: async () => new ArrayBuffer(0),
            }
          : null,
      head: async () => null,
      put: async () => undefined,
      delete: async () => undefined,
    },
    signingSecret: secret,
    allowedOrigins: "https://app.example.test",
    queueVariant,
    cache: {
      match: async (request) => responses.get(request.url),
      put: async (request, response) => {
        responses.set(request.url, response);
      },
    },
  };
  for (const url of [links.url, links.thumbnail_url, links.url]) {
    const response = await servePrivateAsset(
      new Request(url, { headers: { Origin: options.allowedOrigins } }),
      options,
    );
    expect(response.status).toBe(200);
  }
  expect(queueVariant).toHaveBeenCalledTimes(2);
});

it("serves a private original while a missing preview waits for repair", async () => {
  const key = `1234567890/${crypto.randomUUID()}/${crypto.randomUUID()}.png`;
  const secret = "fixture-private-asset-queue-secret-0001";
  const links = await assetDeliverySigner("https://media.example.test", secret)(key);
  const body = new Uint8Array([1, 2, 3]);
  const accessHeaders = { Origin: "https://app.example.test" };
  const queueVariant = vi.fn(async () => {
    throw new Error("QUEUE_TEMPORARILY_UNAVAILABLE");
  });
  const bucket = {
    get: vi.fn(async (objectKey: string) =>
      objectKey === key
        ? {
            size: body.length,
            body: new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(body);
                controller.close();
              },
            }),
            arrayBuffer: async () => body.buffer,
          }
        : null,
    ),
    head: vi.fn(async () => null),
    put: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  };
  const response = await servePrivateAsset(new Request(links.url, { headers: accessHeaders }), {
    bucket,
    signingSecret: secret,
    allowedOrigins: accessHeaders.Origin,
    queueVariant,
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("image/png");
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe(accessHeaders.Origin);
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(body);
  expect(queueVariant).toHaveBeenCalledExactlyOnceWith(key);
});
