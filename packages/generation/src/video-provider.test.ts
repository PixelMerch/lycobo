import { videoInputSchema } from "@lycoboai/contracts";
import { describe, expect, it } from "vitest";
import { callVideoProvider, downloadProviderVideo, videoConfiguration } from "./video-provider";

const config = { origin: "https://api.uselg.top", key: "test-secret" };
describe("Minimax video provider", () => {
  it("uses the exact model, explicit seconds and idempotency without a resolution field", async () => {
    let sent: RequestInit | undefined;
    await callVideoProvider(
      config,
      undefined,
      {
        input: videoInputSchema.parse({ prompt: "参考@图片1 缓慢推进", seconds: 30 }),
        images: ["https://assets.test/reference.png"],
        key: "attempt-id",
      },
      async (_url, init) => {
        sent = init;
        return Response.json({ id: "video-1", status: "queued" }, { status: 202 });
      },
    );
    expect(JSON.parse(String(sent?.body))).toEqual({
      model: "Minimax-h3-933特价",
      prompt: "参考图1 缓慢推进",
      seconds: 30,
      aspect_ratio: "9:16",
      images: ["https://assets.test/reference.png"],
    });
    expect(sent?.headers).toMatchObject({ "Idempotency-Key": "attempt-id" });
  });
  it("preserves uncertainty on a timeout and never resubmits", async () => {
    let requests = 0;
    await expect(
      callVideoProvider(
        config,
        undefined,
        {
          input: videoInputSchema.parse({ prompt: "镜头缓慢推进", seconds: 10 }),
          images: [],
          key: "attempt",
        },
        async () => {
          requests++;
          throw new Error("timeout");
        },
      ),
    ).rejects.toMatchObject({ uncertain: true });
    expect(requests).toBe(1);
  });
  it("marks an explicit validation rejection as definitive", async () => {
    await expect(
      callVideoProvider(
        config,
        undefined,
        {
          input: videoInputSchema.parse({ prompt: "平稳镜头", seconds: 10 }),
          images: [],
          key: "attempt",
        },
        async () => new Response(null, { status: 422 }),
      ),
    ).rejects.toMatchObject({ uncertain: false });
  });
  it("does not send authorization to a trusted download host and rejects other origins", async () => {
    const headers: unknown[] = [];
    const bytes = await downloadProviderVideo(config, "video-1", async (_url, init) => {
      headers.push(init?.headers);
      return headers.length === 1
        ? new Response(null, {
            status: 302,
            headers: { Location: "https://download.ai-media.vip/file.mp4" },
          })
        : new Response(new Uint8Array([1, 2]), { headers: { "Content-Type": "video/mp4" } });
    });
    expect([...bytes]).toEqual([1, 2]);
    expect(headers).toEqual([{ Authorization: "Bearer test-secret" }, {}]);
    await expect(
      downloadProviderVideo(
        config,
        "video-1",
        async () =>
          new Response(null, { status: 302, headers: { Location: "http://127.0.0.1/private" } }),
      ),
    ).rejects.toMatchObject({ code: "VIDEO_DOWNLOAD_ORIGIN_INVALID" });
  });
});

it("video is available by default with the server image key and stays unconfigured without credentials", () => {
  expect(videoConfiguration({})).toBeNull();
  expect(videoConfiguration({ STANDALONE_IMAGE_API_KEY: "shared-image-key" })).toEqual({
    origin: "https://api.uselg.top",
    key: "shared-image-key",
  });
});
