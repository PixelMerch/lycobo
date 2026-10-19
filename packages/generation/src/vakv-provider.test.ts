import { imageGenerationInputSchema } from "@lycoboai/contracts";
import { describe, expect, it, vi } from "vitest";
import {
  generateVakvImage,
  readImagePolicy,
  supportedResolutions,
  validateModelInput,
} from "./vakv-provider";

const input = imageGenerationInputSchema.parse({ model: "gpt-image-2", prompt: "coffee" });
const config = { key: "test-not-a-secret", baseUrl: "https://api.vakv.cn", timeoutMs: 1000 };
describe("Vakv adapter and capability evidence", () => {
  it("enforces documented limits and keeps unknown channels closed", () => {
    expect(supportedResolutions("gpt-image-2")).toEqual(["1K"]);
    expect(supportedResolutions("gpt-image-2-4K")).toEqual(["1K", "2K", "4K"]);
    expect(() => validateModelInput({ ...input, resolution: "4K" })).toThrow(
      "MODEL_RESOLUTION_UNVERIFIED",
    );
    expect(() => validateModelInput({ ...input, model: "gpt-image-2.5-flare" })).toThrow();
    expect(
      supportedResolutions("gpt-image-2.5-sunburst", { "gpt-image-2.5-sunburst": ["1K"] }),
    ).toEqual(["1K"]);
    expect(supportedResolutions("gpt-image-2", { "gpt-image-2": ["4K"] })).toEqual(["1K"]);
    expect(readImagePolicy({}).enabled).toBe(false);
    expect(() =>
      validateModelInput({ ...input, referenceAssetIds: [crypto.randomUUID()] }),
    ).toThrow("IMAGE_EDITS_NOT_VERIFIED");
  });
  it("sends one synchronous request and bounded base64 output", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ b64_json: "aGVsbG8=" }] }), {
        headers: { "x-request-id": "provider-1" },
      }),
    );
    const result = await generateVakvImage(input, [], config, "stable-item-id", request);
    expect(result.bytes.toString()).toBe("hello");
    expect(result.requestId).toBe("provider-1");
    const [url, options] = request.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.vakv.cn/v1/images/generations");
    expect(JSON.parse(String(options?.body))).toMatchObject({
      model: "gpt-image-2",
      size: "1024x1024",
      n: 1,
    });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("never retries ambiguous submissions or downloads arbitrary output URLs", async () => {
    const request = vi.fn<typeof fetch>().mockRejectedValue(new Error("sensitive provider body"));
    await expect(generateVakvImage(input, [], config, "id", request)).rejects.toMatchObject({
      code: "PROVIDER_OUTCOME_UNKNOWN",
      unknownOutcome: true,
    });
    expect(request).toHaveBeenCalledTimes(1);
    const urlOnly = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [{ url: "http://127.0.0.1/secret" }] })),
      );
    await expect(generateVakvImage(input, [], config, "id", urlOnly)).rejects.toMatchObject({
      unknownOutcome: true,
    });
    expect(urlOnly).toHaveBeenCalledTimes(1);
  });
  it("classifies rejection versus unknown outcome without leaking response bodies", async () => {
    for (const [status, unknownOutcome] of [
      [400, false],
      [401, false],
      [429, false],
      [408, true],
      [500, true],
    ] as const) {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("provider-sensitive-prompt", { status }));
      await expect(generateVakvImage(input, [], config, "id", request)).rejects.toMatchObject({
        code: `PROVIDER_HTTP_${status}`,
        unknownOutcome,
      });
    }
  });
  it("bounds a hung request without retrying the paid call", async () => {
    const request = vi.fn<typeof fetch>().mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () => reject(new Error("timeout")), {
            once: true,
          });
        }),
    );
    await expect(
      generateVakvImage(input, [], { ...config, timeoutMs: 20 }, "id", request),
    ).rejects.toMatchObject({ code: "PROVIDER_OUTCOME_UNKNOWN", unknownOutcome: true });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("blocks non-HTTPS provider origins outside isolated fixtures", async () => {
    await expect(
      generateVakvImage(input, [], { ...config, baseUrl: "http://127.0.0.1" }, "id"),
    ).rejects.toMatchObject({ code: "INVALID_PROVIDER_URL" });
  });
});
