import { imageGenerationInputSchema } from "@lycoboai/contracts";
import { expect, it } from "vitest";
import { providerOutputBytes } from "../providers/configured-provider";
import { standaloneCredentialId, standaloneModels } from "./standalone-models";

const env = {
  STANDALONE_MODELS: "true",
  STANDALONE_IMAGE_API_KEY: "fixture-image-secret",
  DEEPSEEK_API_KEY: "fixture-language-secret",
};
it("requires explicit standalone opt-in and refuses missing keys", async () => {
  expect(await standaloneModels({})).toBeUndefined();
  await expect(standaloneModels({ STANDALONE_MODELS: "true" })).rejects.toThrow(
    "STANDALONE_MODEL_SECRETS_REQUIRED",
  );
});
it("routes all public models without any admin or database lookups", async () => {
  const config = await standaloneModels(env);
  expect(config?.capabilities().create?.map((model) => model.id)).toEqual([
    "gpt-image-2.6",
    "gpt-image-2.5",
    "gpt-image-2",
  ]);
  expect(config?.capabilities()["textile-set"]?.map((model) => model.id)).toContain(
    "gpt-image-2.6",
  );
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
  expect(config?.resolve({ ...input, model: "gpt-image-2.6" })).toMatchObject({
    upstreamModel: "gpt-image-2.6",
    adapter: "fluxport-images",
    origin: "https://api.ai-media.vip/",
  });
  expect(config?.resolve({ ...input, model: "nano-banana-2.1" }).adapter).toBe("gemini-native");
  expect(config?.planner).toMatchObject({
    model: "deepseek-flash",
    protocol: "openai-chat",
    origin: "https://api.deepseek.com/",
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

it("uses 2.6 Sunburst for all three commerce tools while preserving normal main image routing", async () => {
  const config = await standaloneModels(env);
  const target = crypto.randomUUID();
  const product = crypto.randomUUID();
  const base = { prompt: "商品摄影", resolution: "4K", count: 1 };
  const inputs = [
    {
      ...base,
      model: "gpt-image-2.6",
      replica: true,
      referenceAssetIds: [target, product],
      referenceRoles: ["style", "product"],
    },
    {
      ...base,
      model: "gpt-image-2.6",
      textileSet: { version: 5, views: ["front"] },
      referenceAssetIds: [product],
    },
    {
      ...base,
      model: "gpt-image-2.5",
      textileSet: { version: 5, views: ["front"] },
      referenceAssetIds: [product],
    },
    {
      ...base,
      model: "gpt-image-2.5",
      variation: {
        version: 1,
        planId: crypto.randomUUID(),
        items: [{ id: crypto.randomUUID(), title: "主图", prompt: "保留商品外观" }],
      },
    },
  ];
  for (const raw of inputs) {
    const snapshot = config?.resolve(imageGenerationInputSchema.parse(raw));
    expect(snapshot).toMatchObject({
      model: "gpt-image-2.6",
      upstreamModel: "gpt-image-2.6-sunburst",
      adapter: "fluxport-images",
    });
  }
  expect(
    config?.resolve(imageGenerationInputSchema.parse({ ...base, model: "gpt-image-2.6" }))
      .upstreamModel,
  ).toBe("gpt-image-2.6");
});
