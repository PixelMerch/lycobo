import { imageGenerationInputSchema } from "@lycoboai/contracts";
import { standaloneModels } from "@lycoboai/generation";
import { expect, it, vi } from "vitest";
import { providerRetryService } from "./provider-retry-service";

it.each(["success", "running"])(
  "retrieves an accepted %s task and resumes storage without another POST",
  async (status) => {
    const configuration = await standaloneModels({
      STANDALONE_MODELS: "true",
      STANDALONE_IMAGE_API_KEY: "fixture",
      DEEPSEEK_API_KEY: "fixture",
    });
    if (!configuration) throw Error("FIXTURE_CONFIG_MISSING");
    const input = imageGenerationInputSchema.parse({ model: "gpt-image-2.5", prompt: "商品摄影" });
    const scope = { userId: crypto.randomUUID(), organizationId: crypto.randomUUID() };
    const jobId = crypto.randomUUID(),
      itemId = crypto.randomUUID();
    const resumeProvider = vi.fn(async () => {}),
      providerCipher = vi.fn(async () => "never-used");
    const providerRequest: typeof fetch = async (url, init) => {
      expect(init?.method).toBe("GET");
      expect(String(url)).toBe("https://api.ai-media.vip/v1/images/tasks/original?view=summary");
      return Response.json(
        status === "success"
          ? { status, assets: [{ url: "https://download.ai-media.vip/fixture.png" }] }
          : { status, task_id: "original" },
      );
    };
    const service = providerRetryService({
      standaloneKey: "fixture",
      providerRequest,
      repository: {
        providerCipher,
        resumeProvider,
        providerRetryCandidates: async () => [
          {
            itemId,
            taskId: "original",
            statusPath: "/v1/images/tasks/original?view=summary",
            snapshot: configuration.resolve(input),
            input,
          },
        ],
      },
    });
    expect(await service(scope, jobId, itemId)).toBe(true);
    expect(resumeProvider).toHaveBeenCalledExactlyOnceWith(scope, jobId, itemId);
    expect(providerCipher).not.toHaveBeenCalled();
  },
);

it.each([500, 404, 401])("does not treat HTTP %i as proof that generation failed", async (http) => {
  const configuration = await standaloneModels({
    STANDALONE_MODELS: "true",
    STANDALONE_IMAGE_API_KEY: "fixture",
    DEEPSEEK_API_KEY: "fixture",
  });
  if (!configuration) throw Error("FIXTURE_CONFIG_MISSING");
  const input = imageGenerationInputSchema.parse({ model: "gpt-image-2.5", prompt: "商品摄影" });
  const resumeProvider = vi.fn(async () => {});
  const service = providerRetryService({
    standaloneKey: "fixture",
    providerRequest: async () => new Response(null, { status: http }),
    repository: {
      providerCipher: async () => "unused",
      resumeProvider,
      providerRetryCandidates: async () => [
        {
          itemId: crypto.randomUUID(),
          taskId: "original",
          statusPath: "/v1/images/tasks/original",
          snapshot: configuration.resolve(input),
          input,
        },
      ],
    },
  });
  await expect(
    service(
      { userId: crypto.randomUUID(), organizationId: crypto.randomUUID() },
      crypto.randomUUID(),
    ),
  ).rejects.toMatchObject({ code: "STATE_CONFLICT" });
  expect(resumeProvider).not.toHaveBeenCalled();
});

it("allows a replacement only after a definitive failed receipt", async () => {
  const configuration = await standaloneModels({
    STANDALONE_MODELS: "true",
    STANDALONE_IMAGE_API_KEY: "fixture",
    DEEPSEEK_API_KEY: "fixture",
  });
  if (!configuration) throw Error("FIXTURE_CONFIG_MISSING");
  const input = imageGenerationInputSchema.parse({ model: "gpt-image-2.5", prompt: "商品摄影" });
  const resumeProvider = vi.fn(async () => {});
  const service = providerRetryService({
    standaloneKey: "fixture",
    providerRequest: async () => Response.json({ status: "failed" }),
    repository: {
      providerCipher: async () => "unused",
      resumeProvider,
      providerRetryCandidates: async () => [
        {
          itemId: crypto.randomUUID(),
          taskId: "original",
          statusPath: "/v1/images/tasks/original",
          snapshot: configuration.resolve(input),
          input,
        },
      ],
    },
  });
  expect(
    await service(
      { userId: crypto.randomUUID(), organizationId: crypto.randomUUID() },
      crypto.randomUUID(),
    ),
  ).toBe(false);
  expect(resumeProvider).not.toHaveBeenCalled();
});
