import { imageGenerationInputSchema, providerSnapshotSchema } from "@lycoboai/contracts";
import { expect, it, vi } from "vitest";
import { imageProtocolAdapters, imageProviderOrigin } from "./provider-adapters";
import { generateVakvImage, imageDimensions } from "./vakv-provider";

it("accepts root and SDK /v1 base URLs without duplicating the endpoint prefix", async () => {
  for (const value of [
    "https://example.com",
    "https://example.com/",
    "https://example.com/v1",
    "https://example.com/v1/",
  ])
    expect(imageProviderOrigin(value)).toBe("https://example.com");
  for (const value of [
    "https://user:secret@example.com/v1",
    "https://example.com/v1?api_key=secret",
    "https://example.com/custom",
  ])
    expect(() => imageProviderOrigin(value)).toThrow();
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ data: [{ b64_json: "aGVsbG8=" }] }));
  await generateVakvImage(
    imageGenerationInputSchema.parse({ model: "gpt-image-2", prompt: "fixture" }),
    [],
    { key: "fixture-key", baseUrl: "https://example.com/v1", timeoutMs: 5000 },
    "item",
    request,
  );
  expect(String(request.mock.calls[0]?.[0])).toBe("https://example.com/v1/images/generations");
  expect(request).toHaveBeenCalledTimes(1);
});

it.each(["openai-images", "fluxport-images"] as const)(
  "caps 4K dimensions at 3840 for %s JSON and reference uploads",
  (adapter) => {
    const snapshot = providerSnapshotSchema.parse({
      channelId: crypto.randomUUID(),
      credentialId: crypto.randomUUID(),
      origin: "https://example.com",
      adapter,
      model: "gpt-image-2",
      upstreamModel: "gpt-image-2",
      mode: "async-preferred",
      editsEnabled: true,
      resolutions: ["1K", "2K", "4K"],
      maxReferences: 6,
      timeoutMs: 5000,
      taskTimeoutSeconds: 600,
      downloadOrigins: [],
    });
    for (const [aspectRatio, size] of [
      ["1:1", "3840x3840"],
      ["16:9", "3840x2160"],
      ["9:16", "2160x3840"],
      ["3:4", "2880x3840"],
    ]) {
      const input = imageGenerationInputSchema.parse({
        model: "gpt-image-2",
        prompt: "fixture",
        resolution: "4K",
        aspectRatio,
      });
      for (const references of [[], [new Uint8Array([1, 2])]]) {
        const { body } = imageProtocolAdapters[adapter].prepare(snapshot, input, references);
        expect(typeof body === "string" ? JSON.parse(body).size : body.get("size")).toBe(size);
      }
    }
  },
);

it("keeps legacy dimensions within the same 4K limit without changing 1K and 2K", () => {
  expect(imageDimensions("1:1", "1K")).toEqual({ width: 1024, height: 1024 });
  expect(imageDimensions("1:1", "2K")).toEqual({ width: 2048, height: 2048 });
  expect(imageDimensions("1:1", "4K")).toEqual({ width: 3840, height: 3840 });
  expect(imageDimensions("9:16", "4K")).toEqual({ width: 2160, height: 3840 });
});
