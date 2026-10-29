import { imageModelsResponseSchema, unwrapApiData } from "@lycoboai/contracts";
import type { ImageRepository } from "@lycoboai/db";
import { supportedResolutions, validateModelInput } from "@lycoboai/generation";
import type { ImageStore } from "@lycoboai/storage";
import { expect, it, vi } from "vitest";
import { createApp } from "../../app";

const unexpected = async (): Promise<never> => {
  throw new Error("Unexpected dependency call");
};
function fixture(editsEnabled = false, managedModelsOnly = false) {
  const create = vi
    .fn<ImageRepository["create"]>()
    .mockResolvedValue({ id: crypto.randomUUID(), replayed: false });
  const repository: ImageRepository = {
    close: unexpected,
    models: {
      logos: async () => ({
        models: [
          {
            id: "gpt-image-2",
            logoUrl: "https://logos.example.com/model.webp",
            name: "Image 2",
            description: "后台介绍",
            capabilitySummary: "后台能力",
          },
        ],
      }),
      list: unexpected,
      saveProvider: unexpected,
      saveChannel: unexpected,
      saveRoute: unexpected,
      provider: unexpected,
      capabilities: async () => ({}),
      hasRoute: async () => false,
    },
    providerCipher: unexpected,
    deferProvider: unexpected,
    storageUid: unexpected,
    assetLocations: unexpected,
    provision: unexpected,
    wallet: unexpected,
    walletEntries: unexpected,
    rechargeOrders: unexpected,
    createRecharge: unexpected,
    settleRecharge: unexpected,
    authenticate: async () => ({
      userId: crypto.randomUUID(),
      organizationId: crypto.randomUUID(),
      role: "member",
    }),
    create,
    list: unexpected,
    archive: unexpected,
    get: unexpected,
    latestEdit: unexpected,
    addReference: unexpected,
    listAssets: unexpected,
    asset: unexpected,
    leaseOutbox: unexpected,
    ackOutbox: unexpected,
    claim: unexpected,
    finish: unexpected,
    pruneEvents: unexpected,
    expireClaims: unexpected,
    reconcile: unexpected,
    retry: unexpected,
    settleInvalidResponses: unexpected,
  };
  const store: ImageStore = {
    ready: unexpected,
    put: unexpected,
    read: unexpected,
    thumbnail: unexpected,
    remove: unexpected,
  };
  const app = createApp(() => {}, {
    repository,
    store,
    enabled: true,
    managedModelsOnly,
    unitCredits: 1,
    validate: (input) => validateModelInput(input, {}, editsEnabled),
    resolutions: supportedResolutions,
  });
  const submit = (quality?: unknown) =>
    app.request("/api/v1/image-tasks", {
      method: "POST",
      headers: {
        Authorization: "Bearer fixture",
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        model: "gpt-image-2",
        prompt: "fixture",
        ...(quality === undefined ? {} : { quality }),
      }),
    });
  return { create, submit, app };
}
it.each(["low", "medium", "high"])(
  "validates and forwards %s quality to task persistence",
  async (quality) => {
    const { create, submit } = fixture();
    const response = await submit(quality);
    expect(response.status).toBe(202);
    expect(unwrapApiData(await response.json())).toMatchObject({ replayed: false });
    expect(create.mock.calls[0]?.[1]).toMatchObject({ quality });
    expect(create.mock.calls[0]?.[3]).toBe(20);
  },
);
it("rejects unknown quality before creating a task and accepts legacy omitted quality", async () => {
  const { create, submit } = fixture();
  for (const quality of ["auto", "标准", null, 1]) expect((await submit(quality)).status).toBe(400);
  expect(create).not.toHaveBeenCalled();
  expect((await submit()).status).toBe(202);
  expect(create.mock.calls[0]?.[1]).not.toHaveProperty("quality");
});

it("advertises and enforces the same per-model resolution policy", async () => {
  const { app, create } = fixture();
  const headers = { Authorization: "Bearer fixture", "Content-Type": "application/json" };
  const response = await app.request("/api/v1/image-models", { headers });
  const body = imageModelsResponseSchema.parse(unwrapApiData(await response.json()));
  expect(body.models.map((model) => model.id)).toEqual([
    "gpt-image-2",
    "gpt-image-2.5",
    "nano-banana-2.1",
  ]);
  expect(body.unitCredits).toBe(20);
  for (const model of body.models) {
    const expected = ["1K", "1.5K", "2K", "4K"];
    expect(model.enabledResolutions).toEqual(expected);
    for (const resolution of ["1K", "1.5K", "2K", "4K"]) {
      const result = await app.request("/api/v1/image-tasks", {
        method: "POST",
        headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ model: model.id, prompt: "fixture", resolution }),
      });
      expect(result.status).toBe(expected.includes(resolution) ? 202 : 400);
    }
  }
  expect(create).toHaveBeenCalledTimes(12);
});

it("normalizes textile presets on the server and rejects missing references", async () => {
  const { app, create } = fixture(true);
  const headers = {
    Authorization: "Bearer fixture",
    "Content-Type": "application/json",
    "Idempotency-Key": crypto.randomUUID(),
  };
  const input = {
    model: "gpt-image-2",
    prompt: "untrusted client preset",
    resolution: "4K",
    quality: "high",
    count: 2,
    referenceAssetIds: [crypto.randomUUID()],
    textileSet: { version: 1, views: ["front", "fabric"] },
  };
  expect(
    (
      await app.request("/api/v1/image-tasks", {
        method: "POST",
        headers,
        body: JSON.stringify(input),
      })
    ).status,
  ).toBe(202);
  expect(create.mock.calls[0]?.[1]).toMatchObject({
    model: "gpt-image-2.5",
    resolution: "1K",
    quality: "medium",
    count: 2,
    prompt: "家纺主图裂变：正面、面料特写。每个视角分别生成一张图片。",
  });
  expect(
    (
      await app.request("/api/v1/image-tasks", {
        method: "POST",
        headers,
        body: JSON.stringify({ ...input, referenceAssetIds: [] }),
      })
    ).status,
  ).toBe(400);
  expect(create).toHaveBeenCalledTimes(1);
});

it("accepts one main plus five details and rejects a sixth detail", async () => {
  const { app, create } = fixture(true);
  const headers = {
    Authorization: "Bearer fixture",
    "Content-Type": "application/json",
    "Idempotency-Key": crypto.randomUUID(),
  };
  const input = {
    model: "gpt-image-2.5",
    prompt: "textile",
    count: 1,
    referenceAssetIds: Array.from({ length: 6 }, () => crypto.randomUUID()),
    textileSet: { version: 2, views: ["front"] },
  };
  expect(
    (
      await app.request("/api/v1/image-tasks", {
        method: "POST",
        headers,
        body: JSON.stringify(input),
      })
    ).status,
  ).toBe(202);
  expect(create.mock.calls[0]?.[1].referenceAssetIds).toEqual(input.referenceAssetIds);
  expect(
    (
      await app.request("/api/v1/image-tasks", {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...input,
          referenceAssetIds: [...input.referenceAssetIds, crypto.randomUUID()],
        }),
      })
    ).status,
  ).toBe(400);
  expect(create).toHaveBeenCalledTimes(1);
});

it("serves display-only model logos without a session or provider secrets", async () => {
  const { app } = fixture();
  const response = await app.request("/api/v1/image-model-logos");
  expect(response.status).toBe(200);
  expect(unwrapApiData(await response.json())).toEqual({
    models: [
      {
        id: "gpt-image-2",
        logoUrl: "https://logos.example.com/model.webp",
        name: "Image 2",
        description: "后台介绍",
        capabilitySummary: "后台能力",
      },
    ],
  });
});

it("rejects missing backend routes before durable submission when runtime requires managed models", async () => {
  const { app, create, submit } = fixture(true, true);
  const response = await submit();
  expect(response.status).toBe(400);
  expect(create).not.toHaveBeenCalled();
  const models = await app.request("/api/v1/image-models", {
    headers: { Authorization: "Bearer fixture" },
  });
  const body = imageModelsResponseSchema.parse(unwrapApiData(await models.json()));
  expect(body.models.every((model) => model.enabledResolutions.length === 0)).toBe(true);
});
