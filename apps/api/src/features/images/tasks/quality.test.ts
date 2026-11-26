import { BillingError } from "@lycoboai/billing";
import { imageModelsResponseSchema, unwrapApiData } from "@lycoboai/contracts";
import type { ImageRepository } from "@lycoboai/db";
import { supportedResolutions, validateModelInput } from "@lycoboai/generation";
import type { ImageStore } from "@lycoboai/storage";
import { assetDeliverySigner } from "@lycoboai/storage/delivery";
import { expect, it, vi } from "vitest";
import { createApp } from "../../../app";
import type { ExternalWalletService } from "../../billing/wallet-service";
import { createCreemModerator } from "../../moderation/creem-moderation";
import type { GenerationModerator } from "../../moderation/service";

const unexpected = async (): Promise<never> => {
  throw new Error("Unexpected dependency call");
};
function fixture(
  editsEnabled = false,
  managedModelsOnly = false,
  extra: {
    wake?: () => Promise<void>;
    wakeBilling?: (id: string) => Promise<void>;
    billing?: ExternalWalletService;
    wallet?: ImageRepository["wallet"];
    walletHistory?: ImageRepository["walletHistory"];
    moderate?: GenerationModerator | undefined;
    get?: ImageRepository["get"];
    retry?: ImageRepository["retry"];
    providerRetryCandidates?: ImageRepository["providerRetryCandidates"];
    getMany?: ImageRepository["getMany"];
    assetLocations?: ImageRepository["assetLocations"];
    asset?: ImageRepository["asset"];
    signAsset?: ReturnType<typeof assetDeliverySigner>;
    optimizer?: {
      repository: ImageRepository["promptOptimization"];
      config: ImageRepository["variation"]["config"];
      request: typeof fetch;
    };
  } = {},
) {
  const create = vi
    .fn<ImageRepository["create"]>()
    .mockResolvedValue({ id: crypto.randomUUID(), replayed: false });
  const repository: ImageRepository = {
    waitingReferenceUploads: unexpected,
    close: unexpected,
    promptOptimization: extra.optimizer?.repository ?? { begin: unexpected, finish: unexpected },
    variation: {
      config: extra.optimizer?.config ?? unexpected,
      begin: unexpected,
      get: unexpected,
      finish: unexpected,
    },
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
    providerRetryCandidates: extra.providerRetryCandidates ?? unexpected,
    resumeProvider: unexpected,
    deferProvider: unexpected,
    webhookWait: unexpected,
    webhookReceive: unexpected,
    pruneWebhooks: unexpected,
    getMany: extra.getMany ?? unexpected,
    storageUid: unexpected,
    assetLocations: extra.assetLocations ?? unexpected,
    expiredReferences: unexpected,
    markReferenceDeleted: unexpected,
    provision: unexpected,
    wallet: extra.wallet ?? (async () => ({ balance: 0 })),
    billingCustomer: unexpected,
    billingEmail: unexpected,
    saveBillingCustomer: unexpected,
    createBillingOrder: unexpected,
    saveBillingCheckout: unexpected,
    confirmBillingOrder: unexpected,
    refreshBillingAccount: unexpected,
    billingEntries: unexpected,
    billingOrders: unexpected,
    leaseGenerationCharges: unexpected,
    finishGenerationCharge: unexpected,
    replayImageSubmission: async () => undefined,
    replayImageRetry: async () => false,
    walletEntries: unexpected,
    walletHistory: extra.walletHistory ?? unexpected,
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
    setAssetFavorite: unexpected,
    favoriteAssetIds: unexpected,
    asset: extra.asset ?? unexpected,
    leaseOutbox: unexpected,
    ackOutbox: unexpected,
    claim: unexpected,
    finish: unexpected,
    pruneEvents: unexpected,
    expireClaims: unexpected,
    reconcile: unexpected,
    retry: extra.retry ?? unexpected,
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
    moderate: extra.moderate,
    billing: extra.billing,
    wakeBilling: extra.wakeBilling,
    store,
    signAsset: extra.signAsset,
    plannerKey: extra.optimizer ? "fixture" : undefined,
    plannerRequest: extra.optimizer?.request,
    enabled: true,
    managedModelsOnly,
    unitCredits: 1,
    wake: extra.wake,
    validate: (input) => validateModelInput(input, {}, editsEnabled),
    resolutions: supportedResolutions,
  });
  const submit = (quality?: unknown, overrides?: Record<string, unknown>) =>
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
        ...overrides,
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
it("blocks rejected submissions before repository or queue calls", async () => {
  const request = vi.fn<typeof fetch>(async () =>
    Response.json({ id: "mod_test", object: "moderation_result", decision: "deny" }),
  );
  const moderate = createCreemModerator(
    { CREEM_MODERATION_ENABLED: "true", CREEM_API_KEY: "creem_test_fixture" },
    request,
  );
  const wake = vi.fn(async () => {});
  const { create, submit } = fixture(false, false, { moderate, wake });
  const result = await submit(undefined, { prompt: "实际生成文案", userPrompt: "仅展示的文案" });
  expect(result.status).toBe(400);
  expect(await result.json()).toMatchObject({ error: { code: "CONTENT_REJECTED" } });
  expect(request.mock.calls[0]?.[1]?.body).toContain("实际生成文案");
  expect(request.mock.calls[0]?.[1]?.body).not.toContain("仅展示的文案");
  expect(create).not.toHaveBeenCalled();
  expect(wake).not.toHaveBeenCalled();
});

it("screens every distinct item in a generated image set before accepting the task", async () => {
  const moderate = vi.fn<GenerationModerator>(async () => undefined);
  const { create, submit } = fixture(false, false, { moderate });
  const result = await submit(undefined, {
    count: 2,
    variation: {
      version: 1,
      planId: crypto.randomUUID(),
      items: [
        { id: crypto.randomUUID(), title: "白底", prompt: "生成一张白色背景的商品图" },
        { id: crypto.randomUUID(), title: "场景", prompt: "生成一张窗边自然光的商品图" },
      ],
    },
  });
  expect(result.status).toBe(202);
  expect(moderate.mock.calls[0]?.[0]).toEqual([
    expect.stringContaining("生成一张白色背景的商品图"),
    expect.stringContaining("生成一张窗边自然光的商品图"),
  ]);
  expect(moderate.mock.invocationCallOrder[0]).toBeLessThan(
    create.mock.invocationCallOrder[0] ?? 0,
  );
});

it("screens the stored content of the selected retry item and binds its position", async () => {
  const jobId = crypto.randomUUID();
  const first = crypto.randomUUID();
  const second = crypto.randomUUID();
  const plan = {
    version: 1,
    planId: crypto.randomUUID(),
    items: [
      { id: crypto.randomUUID(), title: "白底", prompt: "生成一张白色背景的商品图" },
      { id: crypto.randomUUID(), title: "场景", prompt: "生成一张窗边自然光的商品图" },
    ],
  };
  const moderate = vi.fn<GenerationModerator>(async () => undefined);
  const retry = vi.fn<ImageRepository["retry"]>().mockResolvedValue({ id: jobId, replayed: false });
  const { app } = fixture(false, false, {
    moderate,
    retry,
    providerRetryCandidates: async () => [],
    get: async () => ({
      id: jobId,
      input: { model: "gpt-image-2.5", count: 2, prompt: "旧任务", variation: plan },
      items: [
        { id: first, position: 0, status: "failed" },
        { id: second, position: 1, status: "failed" },
      ],
    }),
  });
  const result = await app.request(`/api/v1/image-tasks/${jobId}/retry`, {
    method: "POST",
    headers: {
      Authorization: "Bearer fixture",
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({ itemId: second }),
  });
  expect(result.status).toBe(202);
  expect(moderate.mock.calls[0]?.[0]).toEqual([
    expect.stringContaining("生成一张窗边自然光的商品图"),
  ]);
  expect(retry.mock.calls[0]?.[5]).toEqual([1]);
});
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
    "gpt-image-2.6",
    "gpt-image-2.5",
    "gpt-image-2",
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
  expect(create).toHaveBeenCalledTimes(16);
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

it("batch delivery scopes one lookup, omits inaccessible objects and requires authentication", async () => {
  const own = crypto.randomUUID(),
    other = crypto.randomUUID();
  const assetLocations = vi
    .fn<ImageRepository["assetLocations"]>()
    .mockResolvedValue([{ id: own, objectKey: `0057849613/${crypto.randomUUID()}/${own}.png` }]);
  const { app } = fixture(false, false, {
    assetLocations,
    signAsset: assetDeliverySigner(
      "https://assets.example.test",
      "fixture-signing-secret-with-32-characters",
    ),
  });
  const body = JSON.stringify({ ids: [own, other, own] });
  const unauthenticated = await app.request("/api/v1/image-assets/deliveries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  expect(unauthenticated.status).toBe(401);
  expect(assetLocations).not.toHaveBeenCalled();
  const response = await app.request("/api/v1/image-assets/deliveries", {
    method: "POST",
    headers: { Authorization: "Bearer fixture", "Content-Type": "application/json" },
    body,
  });
  expect(response.status).toBe(200);
  const result = unwrapApiData(await response.json());
  expect(result).toMatchObject({
    data: [{ id: own, delivery: { download_url: expect.stringContaining("variant=download") } }],
  });
  expect(assetLocations).toHaveBeenCalledTimes(1);
  expect(assetLocations).toHaveBeenCalledWith(
    expect.objectContaining({ organizationId: expect.any(String), userId: expect.any(String) }),
    [own, other],
  );
});
it("expired original download fallback redirects to the original capability", async () => {
  const id = crypto.randomUUID();
  const asset = vi.fn<ImageRepository["asset"]>().mockResolvedValue({
    id,
    objectKey: `0057849613/${crypto.randomUUID()}/${id}.png`,
    mimeType: "image/png",
    width: 1,
    height: 1,
    bytes: 3,
    sha256: "fixture",
  });
  const { app } = fixture(false, false, {
    asset,
    assetLocations: async (scope, ids) => {
      const row = await asset(scope, id);
      return row && ids.includes(id) ? [{ id, objectKey: row.objectKey }] : [];
    },
    signAsset: assetDeliverySigner(
      "https://assets.example.test",
      "fixture-signing-secret-with-32-characters",
    ),
  });
  const response = await app.request(`/api/v1/image-assets/${id}/content?download=1`, {
    headers: { Authorization: "Bearer fixture" },
  });
  expect(response.status).toBe(302);
  expect(new URL(response.headers.get("Location") ?? "").searchParams.get("variant")).toBe(
    "download",
  );
  asset.mockResolvedValue(null);
  expect(
    (
      await app.request(`/api/v1/image-assets/${id}/content?download=1`, {
        headers: { Authorization: "Bearer fixture" },
      })
    ).status,
  ).toBe(404);
});

it("streams DeepSeek text and only completes after the result is settled", async () => {
  const rewritten = "晨光照亮浅色床品，使用侧光突出纹理，参考 @图片1。";
  const begin = vi
    .fn<ImageRepository["promptOptimization"]["begin"]>()
    .mockResolvedValue({ status: "started" });
  const finish = vi
    .fn<ImageRepository["promptOptimization"]["finish"]>()
    .mockResolvedValue({ status: "ready", result: rewritten });
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(
        [
          `data: ${JSON.stringify({ choices: [{ delta: { content: rewritten, reasoning_content: "private" } }] })}`,
          'data: {"choices":[{"finish_reason":"stop"}]}',
          "data: [DONE]",
          "",
        ].join("\n\n"),
        { headers: { "Content-Type": "text/event-stream" } },
      ),
    );
  const { app } = fixture(false, false, {
    optimizer: {
      repository: { begin, finish },
      config: async () => ({
        origin: "https://api.deepseek.com/",
        model: "deepseek-flash",
        protocol: "openai-chat",
        timeoutMs: 1000,
        ciphertext: "",
      }),
      request,
    },
  });
  const key = crypto.randomUUID();
  const optimize = () =>
    app.request("/api/v1/prompt-optimizations", {
      method: "POST",
      headers: {
        Authorization: "Bearer fixture",
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify({ tool: "create", prompt: "床品 @图片1" }),
    });
  const response = await optimize();
  const stream = await response.text();
  expect(response.headers.get("Content-Type")).toContain("text/event-stream");
  expect(stream).toContain(`event: delta\ndata: ${JSON.stringify({ text: rewritten })}`);
  expect(stream).toContain(`event: complete\ndata: ${JSON.stringify({ text: rewritten })}`);
  expect(stream).not.toContain("private");
  expect(finish).toHaveBeenCalledWith(expect.anything(), key, rewritten);
  begin.mockResolvedValue({ status: "ready", result: rewritten });
  expect(await (await optimize()).text()).toContain("event: complete");
  expect(request).toHaveBeenCalledTimes(1);
  expect(finish).toHaveBeenCalledTimes(1);
});

it("persists separate per-image billing approvals and routes the task to billing before generation", async () => {
  const generationAccount = vi.fn(async () => ({ provider: "fixture", accountId: "cca_fixture" }));
  const moderate = vi.fn<GenerationModerator>(async () => ["mod_one", "mod_two"]);
  const wakeBilling = vi.fn(async () => {});
  const wake = vi.fn(async () => {});
  const { create, submit } = fixture(false, false, {
    billing: {
      provider: "fixture",
      generationAccount,
      balance: unexpected,
    },
    moderate,
    wake,
    wakeBilling,
  });
  expect((await submit(undefined, { count: 2 })).status).toBe(202);
  expect(generationAccount).toHaveBeenCalledWith(expect.anything(), 4);
  expect(moderate.mock.calls[0]?.[3]).toBe(true);
  expect(create.mock.calls[0]?.[6]).toEqual({
    provider: "fixture",
    accountId: "cca_fixture",
    approvals: new Map([
      [0, "mod_one"],
      [1, "mod_two"],
    ]),
  });
  expect(wakeBilling).toHaveBeenCalledOnce();
  expect(wake).not.toHaveBeenCalled();
});

it("returns insufficient credits before persisting a generation in external billing mode", async () => {
  const moderate = vi.fn<GenerationModerator>(async () => ["mod_one"]);
  const { create, submit } = fixture(false, false, {
    billing: {
      provider: "fixture",
      generationAccount: async () => {
        throw new BillingError("INSUFFICIENT_CREDITS");
      },
      balance: unexpected,
    },
    wallet: async () => ({ balance: 1 }),
    moderate,
  });
  const rejected = await submit();
  expect(rejected.status).toBe(409);
  expect(await rejected.json()).toMatchObject({ error: { code: "INSUFFICIENT_CREDITS" } });
  expect(create).not.toHaveBeenCalled();
  expect(moderate).not.toHaveBeenCalled();
});

it("screens local-funded tasks before charging only the local wallet", async () => {
  const generationAccount = vi.fn(async () => ({ provider: "fixture", accountId: "cca_fixture" }));
  const moderate = vi.fn<GenerationModerator>(async () => ["mod_one", "mod_two"]);
  const wakeBilling = vi.fn(async () => {});
  const wake = vi.fn(async () => {});
  const { create, submit } = fixture(false, false, {
    billing: { provider: "fixture", generationAccount, balance: unexpected },
    wallet: async () => ({ balance: 4 }),
    moderate,
    wake,
    wakeBilling,
  });
  expect((await submit(undefined, { count: 2 })).status).toBe(202);
  expect(generationAccount).not.toHaveBeenCalled();
  expect(create.mock.calls[0]?.[6]).toBeUndefined();
  expect(moderate).toHaveBeenCalledOnce();
  expect(moderate.mock.calls[0]?.[3]).toBeUndefined();
  expect(moderate.mock.invocationCallOrder[0]).toBeLessThan(
    create.mock.invocationCallOrder[0] ?? 0,
  );
  expect(wake).toHaveBeenCalledOnce();
  expect(wakeBilling).not.toHaveBeenCalled();
});

it("preserves the local balance if the purchased wallet cannot be read", async () => {
  const { app } = fixture(false, false, {
    billing: { provider: "fixture", generationAccount: unexpected, balance: unexpected },
    wallet: async () => ({ balance: 18 }),
  });
  const response = await app.request("/api/v1/wallet", {
    headers: { Authorization: "Bearer fixture" },
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    data: { balance: 18, unitCredits: 2, purchasedBalance: null },
  });
});

it("validates unified credit history cursors before reading the authenticated account", async () => {
  const walletHistory = vi.fn<ImageRepository["walletHistory"]>().mockResolvedValue({
    data: [],
    nextCursor: null,
  });
  const { app } = fixture(false, false, { walletHistory });
  const headers = { Authorization: "Bearer fixture" };
  const endpoint = "/api/v1/wallet/history";
  for (const before of [
    "2026-11-26T00:00:00.123456Z/0/invalid",
    "2026-11-26T00:00:00.123456Z/2/42",
    "2026-11-26T00:00:00.123456Z/1/9223372036854775808",
  ]) {
    const response = await app.request(`${endpoint}?${new URLSearchParams({ before })}`, {
      headers,
    });
    expect(response.status).toBe(400);
  }
  expect(walletHistory).not.toHaveBeenCalled();
  const time = "2026-11-26T00:00:00.123456Z";
  const params = new URLSearchParams({ before: `${time}/1/42`, view: "spent", limit: "5" });
  expect((await app.request(`${endpoint}?${params}`, { headers })).status).toBe(200);
  expect(walletHistory).toHaveBeenCalledWith(
    expect.objectContaining({ userId: expect.any(String), organizationId: expect.any(String) }),
    5,
    "spent",
    [time, "1", "42"],
  );
});
