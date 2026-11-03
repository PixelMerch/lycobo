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
