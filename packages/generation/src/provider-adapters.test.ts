import { imageGenerationInputSchema } from "@lycoboai/contracts";
import { expect, it, vi } from "vitest";
import { imageProviderOrigin } from "./provider-adapters";
import { generateVakvImage } from "./vakv-provider";

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
