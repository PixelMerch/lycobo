import { imageModelsResponseSchema, unwrapApiData } from "@lycoboai/contracts";
import type { ImageRepository } from "@lycoboai/db";
import { supportedResolutions, validateModelInput } from "@lycoboai/generation";
import type { ImageStore } from "@lycoboai/storage";
import { expect, it, vi } from "vitest";
import { createApp } from "../../app";

const unexpected = async (): Promise<never> => {
  throw new Error("Unexpected dependency call");
};
function fixture(
  editsEnabled = false,
  managedModelsOnly = false,
  extra: {
    wake?: () => Promise<void>;
    get?: ImageRepository["get"];
    getMany?: ImageRepository["getMany"];
  } = {},
) {
  const create = vi
    .fn<ImageRepository["create"]>()
    .mockResolvedValue({ id: crypto.randomUUID(), replayed: false });
  const repository: ImageRepository = {
    close: unexpected,
    variation: { config: unexpected, begin: unexpected, get: unexpected, finish: unexpected },
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
    providerRetryCandidates: unexpected,
    resumeProvider: unexpected,
    deferProvider: unexpected,
    webhookWait: unexpected,
    webhookReceive: unexpected,
    pruneWebhooks: unexpected,
    getMany: extra.getMany ?? unexpected,
    storageUid: unexpected,
    assetLocations: unexpected,
    expiredReferences: unexpected,
    markReferenceDeleted: unexpected,
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
    get: extra.get ?? unexpected,
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
    wake: extra.wake,
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
    expect(create.mock.calls[0]?.[3]).toBe(2);
  },
);
it("wakes background processing once per newly enqueued task, never for a replay", async () => {
  const wake = vi.fn(async () => {});
  const { create, submit } = fixture(false, false, { wake });
  expect((await submit()).status).toBe(202);
  expect(wake).toHaveBeenCalledOnce();
  create.mockResolvedValueOnce({ id: crypto.randomUUID(), replayed: true });
  expect((await submit()).status).toBe(200);
  expect(wake).toHaveBeenCalledOnce();
});
it("re-wakes processing for a task still queued while polled, at most every 15 seconds", async () => {
  const wake = vi.fn(async () => {});
  const row = (seconds: number, status = "queued") => ({
    id: crypto.randomUUID(),
    status,
    created_at: new Date(Date.now() - seconds * 1000).toISOString(),
    items: [],
  });
  const stale = row(20);
  const rows = [stale, stale, row(5), row(60, "running")];
  const { app } = fixture(false, false, { wake, get: async () => rows.shift() ?? null });
  const poll = (id: string) =>
    app.request(`/api/v1/image-tasks/${id}`, { headers: { Authorization: "Bearer fixture" } });
  expect((await poll(stale.id)).status).toBe(200);
  expect(wake).toHaveBeenCalledOnce();
  await poll(stale.id);
  await poll(crypto.randomUUID());
  await poll(crypto.randomUUID());
  expect(wake).toHaveBeenCalledOnce();
});
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
  expect(body.unitCredits).toBe(2);
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

it("validates and deduplicates authenticated batch queries and wakes once for due work", async () => {
  const ids = [crypto.randomUUID(), crypto.randomUUID()];
  const wake = vi.fn(async () => {});
  const getMany = vi
    .fn<ImageRepository["getMany"]>()
    .mockResolvedValue(
      ids.map((id) => ({ id, status: "running", created_at: new Date(), recovery_due: true })),
    );
  const { app } = fixture(false, false, { wake, getMany });
  const url = `/api/v1/image-tasks/status?ids=${[...ids, ids[0]].join(",")}`;
  expect((await app.request(url)).status).toBe(401);
  expect(getMany).not.toHaveBeenCalled();
  const headers = { Authorization: "Bearer fixture" };
  expect((await app.request(url, { headers })).status).toBe(200);
  expect(getMany.mock.calls[0]?.[1]).toEqual(ids);
  expect(wake).toHaveBeenCalledTimes(1);
  expect((await app.request("/api/v1/image-tasks/status?ids=invalid", { headers })).status).toBe(
    400,
  );
  expect(
    (
      await app.request(`/api/v1/image-tasks/status?ids=${Array(51).fill(ids[0]).join(",")}`, {
        headers,
      })
    ).status,
  ).toBe(400);
  expect(getMany).toHaveBeenCalledTimes(1);
});

it("preserves original variation requirements while retaining per-image prompts", async () => {
  const { app, create } = fixture();
  const prompt = "生成红色和蓝色两款商品图，保留白色区域。";
  const items = [
    { id: crypto.randomUUID(), title: "红色款", prompt: "主色改成红色，保留白色区域。" },
    { id: crypto.randomUUID(), title: "蓝色款", prompt: "主色改成蓝色，保留白色区域。" },
  ];
  const response = await app.request("/api/v1/image-tasks", {
    method: "POST",
    headers: {
      Authorization: "Bearer fixture",
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      model: "gpt-image-2.5",
      prompt,
      count: 2,
      variation: { version: 1, planId: crypto.randomUUID(), items },
    }),
  });
  expect(response.status).toBe(202);
  expect(create.mock.calls[0]?.[1]).toMatchObject({ prompt, variation: { items } });
});
