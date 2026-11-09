import { videoCredentialHash, videoRepository } from "@lycoboai/db";
import type { ImageObjectBucket } from "@lycoboai/storage/bucket";
import { expect, it, vi } from "vitest";
import { processVideoIntent } from "./video-processor";

it("submits text-only video with local HTTP storage without constructing a reference URL", async () => {
  const config = {
    origin: "https://api.uselg.top",
    key: "fixture-key",
    assetOrigin: "http://127.0.0.1:8791",
    signingSecret: "x".repeat(40),
  };
  const run = vi.fn(async (operation: string) =>
    operation === "claim"
      ? {
          id: crypto.randomUUID(),
          itemId: crypto.randomUUID(),
          organizationId: crypto.randomUUID(),
          userId: crypto.randomUUID(),
          token: crypto.randomUUID(),
          input: { prompt: "床品宣传视频", seconds: 10 },
          origin: config.origin,
          credentialHash: videoCredentialHash(config.key),
          providerTaskId: null,
          failures: 0,
          submit: true,
          references: [],
        }
      : null,
  );
  const bucket: ImageObjectBucket = { put: vi.fn(), get: vi.fn(), head: vi.fn(), delete: vi.fn() };
  const request = vi.fn<typeof fetch>(async () =>
    Response.json({ id: "fixture-video", status: "queued" }),
  );
  await processVideoIntent(videoRepository(run), bucket, config, request);
  expect(request).toHaveBeenCalledOnce();
  expect(run).toHaveBeenCalledWith(
    "defer",
    expect.objectContaining({ providerTaskId: "fixture-video" }),
  );
  expect(run).not.toHaveBeenCalledWith("finish", expect.anything());
});

it.each([
  { origin: "https://assets.example.com", status: 206, type: "image/png", submitted: true },
  { origin: "https://assets.example.com", status: 404, type: "image/png", submitted: false },
  { origin: "https://assets.example.com", status: 200, type: "text/html", submitted: false },
  { origin: "https://127.0.0.1", status: 206, type: "image/png", submitted: false },
])(
  "checks the signed reference before provider submission ($origin, $status, $type)",
  async (fixture) => {
    const config = {
      origin: "https://api.uselg.top",
      key: "fixture-key",
      assetOrigin: "http://127.0.0.1:8791",
      signingSecret: "x".repeat(40),
      referenceUrl: async () => `${fixture.origin}/reference.png?token=fixture`,
    };
    const assetId = crypto.randomUUID();
    const run = vi.fn(async (operation: string) =>
      operation === "claim"
        ? {
            id: crypto.randomUUID(),
            itemId: crypto.randomUUID(),
            organizationId: crypto.randomUUID(),
            userId: crypto.randomUUID(),
            token: crypto.randomUUID(),
            input: { prompt: "床品宣传视频", seconds: 10, referenceAssetIds: [assetId] },
            origin: config.origin,
            credentialHash: videoCredentialHash(config.key),
            providerTaskId: null,
            failures: 0,
            submit: true,
            references: [{ id: assetId, objectKey: "reference.png" }],
          }
        : null,
    );
    const bucket: ImageObjectBucket = {
      put: vi.fn(),
      get: vi.fn(),
      head: vi.fn(),
      delete: vi.fn(),
    };
    const request = vi.fn<typeof fetch>(async (_url, init) =>
      init?.method === "GET"
        ? new Response(null, { status: fixture.status, headers: { "Content-Type": fixture.type } })
        : Response.json({ id: "fixture-video", status: "queued" }),
    );
    await processVideoIntent(videoRepository(run), bucket, config, request);
    const link = await config.referenceUrl();
    if (fixture.origin.startsWith("https://127.")) expect(request).not.toHaveBeenCalled();
    else
      expect(request.mock.calls[0]).toEqual([
        link,
        expect.objectContaining({
          method: "GET",
          headers: { Range: "bytes=0-7" },
          redirect: "manual",
        }),
      ]);
    if (fixture.submitted) {
      expect(JSON.parse(String(request.mock.calls[1]?.[1]?.body)).images).toEqual([link]);
      expect(run).toHaveBeenCalledWith(
        "defer",
        expect.objectContaining({ providerTaskId: "fixture-video" }),
      );
    } else {
      expect(request.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
      expect(run).toHaveBeenCalledWith(
        "finish",
        expect.objectContaining({ status: "failed", errorCode: "VIDEO_REFERENCES_UNAVAILABLE" }),
      );
    }
  },
);
