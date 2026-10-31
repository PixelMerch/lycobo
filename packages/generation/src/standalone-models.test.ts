import { imageGenerationInputSchema } from "@lycoboai/contracts";
import { expect, it } from "vitest";
import { providerOutputBytes } from "./configured-provider";
import { standaloneCredentialId, standaloneModels } from "./standalone-models";

const env = {
  STANDALONE_MODELS: "true",
  STANDALONE_IMAGE_API_KEY: "fixture-image-secret",
  STANDALONE_PLANNER_API_KEY: "fixture-language-secret",
};
it("requires explicit standalone opt-in and refuses missing keys", async () => {
  expect(await standaloneModels({})).toBeUndefined();
  await expect(standaloneModels({ STANDALONE_MODELS: "true" })).rejects.toThrow(
    "STANDALONE_MODEL_SECRETS_REQUIRED",
  );
});
it("routes all public models without any admin or database lookups", async () => {
  const config = await standaloneModels(env);
  expect(config?.capabilities().create).toHaveLength(4);
  const input = imageGenerationInputSchema.parse({
    model: "gpt-image-2.5",
    prompt: "商品摄影",
    resolution: "4K",
  });
  const snapshot = config?.resolve(input);
  expect(snapshot).toMatchObject({
    upstreamModel: "gpt-image-2.5-sunburst",
    origin: "https://api.ai-media.vip/",
    credentialId: standaloneCredentialId,
  });
  expect(JSON.stringify(snapshot)).not.toContain(env.STANDALONE_IMAGE_API_KEY);
  expect(config?.resolve({ ...input, model: "nano-banana-2.1" }).adapter).toBe("gemini-native");
  expect(config?.planner).toMatchObject({
    model: "claude-sonnet-5",
    protocol: "anthropic-messages",
    origin: "https://api.uselg.top/",
  });
  expect(() => config?.resolve({ ...input, model: "grok-imagine-image-2.0" })).toThrow(
    "MODEL_CHANNEL_DISABLED",
  );
});

it("downloads standalone provider results without forwarding credentials to its CDN", async () => {
  const config = await standaloneModels(env);
  if (!config) throw new Error("STANDALONE_CONFIG_REQUIRED");
  const snapshot = config.resolve(
    imageGenerationInputSchema.parse({ model: "gpt-image-2.5", prompt: "商品摄影" }),
  );
  const bytes = await providerOutputBytes(
    { url: "https://download.ai-media.vip/result.png" },
    snapshot,
    env.STANDALONE_IMAGE_API_KEY,
    async (_url, init) => {
      expect(new Headers(init?.headers).has("Authorization")).toBe(false);
      return new Response(new Uint8Array([1, 2, 3]));
    },
  );
  expect(bytes.length).toBe(3);
  await expect(
    providerOutputBytes(
      { url: "https://untrusted.example/result.png" },
      snapshot,
      env.STANDALONE_IMAGE_API_KEY,
    ),
  ).rejects.toThrow("PROVIDER_UNTRUSTED_RESULT_URL");
});
