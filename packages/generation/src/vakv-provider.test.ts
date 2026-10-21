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
  it("allows all resolutions through public-model routing", () => {
    expect(supportedResolutions("gpt-image-2")).toEqual(["1K", "2K", "4K"]);
    expect(supportedResolutions("gpt-image-2-4K")).toEqual(["1K", "2K", "4K"]);
    expect(() => validateModelInput({ ...input, resolution: "4K" })).not.toThrow();
    for (const model of [
      "gpt-image-2.5",
      "gpt-image-2.5-flare",
      "gpt-image-2.5-sunburst",
    ] as const) {
      expect(supportedResolutions(model)).toEqual(["1K", "2K", "4K"]);
      expect(() => validateModelInput({ ...input, model })).not.toThrow();
      for (const resolution of ["2K", "4K"] as const)
        expect(() => validateModelInput({ ...input, model, resolution })).not.toThrow();
    }
    expect(
      supportedResolutions("gpt-image-2.5-sunburst", { "gpt-image-2.5-sunburst": ["1K"] }),
    ).toEqual(["1K", "2K", "4K"]);
    expect(supportedResolutions("gpt-image-2", { "gpt-image-2": ["4K"] })).toEqual([
      "1K",
      "2K",
      "4K",
    ]);
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
      quality: "medium",
      n: 1,
    });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it.each(["low", "medium", "high"] as const)(
    "forwards %s quality in JSON and multipart requests",
    async (quality) => {
      for (const references of [[], [new Uint8Array([1, 2, 3])]]) {
        const request = vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: "aGVsbG8=" }] })));
        await generateVakvImage({ ...input, quality }, references, config, "quality-item", request);
        const options = request.mock.calls[0]?.[1];
        if (references.length) {
          expect(options?.body).toBeInstanceOf(FormData);
          const body = options?.body;
          if (!(body instanceof FormData)) throw new Error("Expected multipart body");
          expect(body.get("quality")).toBe(quality);
        } else expect(JSON.parse(String(options?.body)).quality).toBe(quality);
      }
    },
  );
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

it.each([
  ["gpt-image-2", "1K", "gpt-image-2"],
  ["gpt-image-2", "2K", "gpt-image-2-4K"],
  ["gpt-image-2", "4K", "gpt-image-2-4K"],
  ["gpt-image-2.5", "1K", "gpt-image-2.5-sunburst"],
  ["gpt-image-2.5", "4K", "gpt-image-2.5-sunburst"],
  ["nano-banana-2.1", "2K", "gemini-nano-banana-2.1"],
])("routes %s at %s to %s for both generation and edits", async (model, resolution, provider) => {
  for (const refs of [[], [new Uint8Array([1])]]) {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: "aGVsbG8=" }] })));
    await generateVakvImage(
      imageGenerationInputSchema.parse({ model, resolution, prompt: "fixture" }),
      refs,
      config,
      "item",
      request,
    );
    const body = request.mock.calls[0]?.[1]?.body;
    expect(body instanceof FormData ? body.get("model") : JSON.parse(String(body)).model).toBe(
      provider,
    );
  }
  expect(readImagePolicy({ IMAGE_CREDITS_PER_IMAGE: "1" }).unitCredits).toBe(20);
});

it("separates response-header wait from response-body download without logging payloads", async () => {
  let now = 0;
  const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
  const events: unknown[] = [];
  const request = vi.fn<typeof fetch>().mockImplementation(async () => {
    now = 25_000;
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"data":[{"b64_json":"aGVsbG8="}]}'));
        },
        pull(controller) {
          now = 265_000;
          controller.close();
        },
      }),
    );
  });
  try {
    await generateVakvImage(
      input,
      [],
      { ...config, onTiming: (event: unknown) => events.push(event) },
      "timing-test",
      request,
    );
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: "provider_headers", durationMs: 25000 }),
        expect.objectContaining({ stage: "provider_body", durationMs: 240000 }),
      ]),
    );
    expect(JSON.stringify(events)).not.toMatch(/coffee|aGVsbG8|test-not-a-secret/);
    expect(request).toHaveBeenCalledTimes(1);
  } finally {
    clock.mockRestore();
  }
});

it("does not lose a paid result when the timing sink fails", async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: "aGVsbG8=" }] })));
  const result = await generateVakvImage(
    input,
    [],
    {
      ...config,
      onTiming: () => {
        throw new Error("telemetry unavailable");
      },
    },
    "safe-timing",
    request,
  );
  expect(result.bytes.toString()).toBe("hello");
  expect(request).toHaveBeenCalledTimes(1);
});
