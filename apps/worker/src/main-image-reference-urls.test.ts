import { imageGenerationInputSchema, type StoredImage } from "@lycoboai/contracts";
import type { ClaimedImage } from "@lycoboai/db";
import { standaloneModels } from "@lycoboai/generation";
import { expect, it, vi } from "vitest";
import { processConfiguredImage } from "./configured-image-processor";

const keys = {
  STANDALONE_MODELS: "true",
  STANDALONE_IMAGE_API_KEY: "fixture",
  DEEPSEEK_API_KEY: "fixture",
};
const models = [
  "gpt-image-2",
  "gpt-image-2.5",
  "nano-banana-2.1",
  "gemini-3-pro-image-preview",
] as const;
type Model = (typeof models)[number];

async function fixture(model: Model, hasReference = true) {
  const id = crypto.randomUUID();
  const input = imageGenerationInputSchema.parse({
    model,
    prompt: "Fixture prompt",
    referenceAssetIds: hasReference ? [id] : [],
  });
  const configuration = await standaloneModels(keys);
  if (!configuration) throw new Error("Expected standalone configuration");
  const snapshot = configuration.resolve(input);
  const job: ClaimedImage = {
    itemId: id,
    jobId: crypto.randomUUID(),
    organizationId: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    position: 0,
    executionToken: crypto.randomUUID(),
    input,
    providerModel: input.model,
    configuredProvider: {
      snapshot,
      phase: "submitting",
      taskId: null,
      statusPath: null,
      deadlineAt: new Date(Date.now() + 10000),
      pollFailures: 0,
    },
  };
  const asset: StoredImage = {
    id,
    objectKey: `1234567890/${job.organizationId}/${id}.png`,
    mimeType: "image/png",
    bytes: 3,
    width: 1,
    height: 1,
    sha256: "f".repeat(64),
  };
  const request = vi
    .fn<typeof fetch>()
    .mockImplementation(async () =>
      Response.json(
        { task_id: "fixture", status: "queued", status_url: "/v1/images/tasks/fixture" },
        { status: 202 },
      ),
    );
  const signed = new URL("https://private.example/reference.png.provider-v1.jpg?token=fixture");
  const deps = {
    repository: {
      providerCipher: async () => "unused",
      asset: vi.fn(async () => asset),
      finish: vi.fn(async () => true),
      deferProvider: vi.fn(async () => {}),
      webhookWait: async () => false,
    },
    store: { read: vi.fn(async () => new Uint8Array([1, 2, 3])), put: async () => asset },
    standaloneKey: keys.STANDALONE_IMAGE_API_KEY,
    requireMainImageReferenceUrls: true,
    request,
    deliverReference: vi.fn(async () => signed),
  };
  return { job, deps, snapshot, signed };
}

it.each(models)("sends only signed reference URLs for main image model %s", async (model) => {
  const { job, deps, snapshot, signed } = await fixture(model);
  await processConfiguredImage(job, deps);
  expect(deps.request).toHaveBeenCalledOnce();
  const [url, init] = deps.request.mock.calls[0] ?? [];
  const body = String(init?.body);
  expect(body).not.toMatch(/base64|inlineData|data:image/);
  if (snapshot.adapter === "fluxport-images") {
    expect(String(url)).toBe("https://api.ai-media.vip/v1/images/edits");
    expect(JSON.parse(body).images).toEqual([{ image_url: signed.href }]);
  } else {
    expect(String(url)).toBe(
      `https://api.ai-media.vip/v1beta/models/${snapshot.upstreamModel}:generateContent`,
    );
    expect(JSON.parse(body).contents[0].parts).toContainEqual({
      fileData: { fileUri: signed.href, mimeType: "image/jpeg" },
    });
  }
  expect(deps.store.read).not.toHaveBeenCalled();
  expect(deps.repository.deferProvider).toHaveBeenCalledOnce();
});

it("settles signing failures before any paid request and keeps text-only submissions available", async () => {
  const signed = await fixture("gpt-image-2.5");
  signed.deps.deliverReference.mockRejectedValue(new Error("fixture signing failure"));
  await processConfiguredImage(signed.job, signed.deps);
  expect(signed.deps.request).not.toHaveBeenCalled();
  expect(signed.deps.store.read).not.toHaveBeenCalled();
  expect(signed.deps.repository.finish).toHaveBeenCalledWith(
    signed.job,
    expect.objectContaining({
      errorCode: "REFERENCE_STORAGE_UNAVAILABLE",
      unknown: false,
    }),
  );

  const plain = await fixture("gpt-image-2.5", false);
  await processConfiguredImage(plain.job, plain.deps);
  expect(plain.deps.deliverReference).not.toHaveBeenCalled();
  expect(String(plain.deps.request.mock.calls[0]?.[0])).toBe(
    "https://api.ai-media.vip/v1/images/generations",
  );
});

it("rejects main image references if the runtime has no signer", async () => {
  const { job, deps } = await fixture("nano-banana-2.1");
  const { deliverReference, ...unsigned } = deps;
  await processConfiguredImage(job, unsigned);
  expect(deliverReference).not.toHaveBeenCalled();
  expect(deps.request).not.toHaveBeenCalled();
  expect(deps.store.read).not.toHaveBeenCalled();
  expect(deps.repository.finish).toHaveBeenCalledWith(
    job,
    expect.objectContaining({ errorCode: "PROVIDER_REFERENCE_URL_REQUIRED", unknown: false }),
  );
});
