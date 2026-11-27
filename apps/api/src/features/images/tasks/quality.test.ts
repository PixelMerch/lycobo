import { BillingError } from "@lycoboai/billing";
import {
  defaultCreditOfferEnd,
  imageModelsResponseSchema,
  unwrapApiData,
} from "@lycoboai/contracts";
import type { ImageRepository } from "@lycoboai/db";
import { sealProviderKey, supportedResolutions, validateModelInput } from "@lycoboai/generation";
import type { ImageStore } from "@lycoboai/storage";
import { assetDeliverySigner } from "@lycoboai/storage/delivery";
import { expect, it, vi } from "vitest";
import { z } from "zod";
import { createApp } from "../../../app";
import type { CheckoutService } from "../../billing/service";
import type { ExternalWalletService } from "../../billing/wallet-service";
import { createCreemModerator } from "../../moderation/creem-moderation";
import type { GenerationModerator } from "../../moderation/service";
import type { ImageApiDependencies, ImageRequestRateLimits } from "../route-context";

const unexpected = async (): Promise<never> => {
  throw new Error("Unexpected dependency call");
};
const fixtureAutomationSecret = Buffer.alloc(32, 1).toString("base64");
function fixture(
  editsEnabled = false,
  managedModelsOnly = false,
  extra: {
    automation?: Partial<ImageRepository["automation"]>;
    saveAutomationPlan?: ImageRepository["variation"]["saveAutomationPlan"];
    auth?: ImageApiDependencies["auth"];
    rateLimits?: ImageRequestRateLimits;
    wake?: () => Promise<void>;
    wakeBilling?: (id: string) => Promise<void>;
    billing?: ExternalWalletService;
    checkout?: CheckoutService;
    wallet?: ImageRepository["wallet"];
    walletHistory?: ImageRepository["walletHistory"];
    moderate?: GenerationModerator | undefined;
    get?: ImageRepository["get"];
    retry?: ImageRepository["retry"];
    providerRetryCandidates?: ImageRepository["providerRetryCandidates"];
    getMany?: ImageRepository["getMany"];
    assetLocations?: ImageRepository["assetLocations"];
    asset?: ImageRepository["asset"];
    automationReferences?: ImageRepository["automationReferences"];
    ownsAutomationReferences?: ImageRepository["ownsAutomationReferences"];
    addAutomationReference?: ImageRepository["addAutomationReference"];
    putAutomationReference?: NonNullable<ImageStore["putAutomationReference"]>;
    readDisplayThumbnail?: NonNullable<ImageStore["readDisplayThumbnail"]>;
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
    .mockImplementation(async (_scope, { aspectRatio }) => ({
      id: crypto.randomUUID(),
      publicId: "WS8TZGMH5",
      aspectRatio,
      replayed: false,
    }));
  const userId = crypto.randomUUID();
  const repository: ImageRepository = {
    automation: {
      status: unexpected,
      keyCiphertext: unexpected,
      rotate: unexpected,
      revoke: unexpected,
      authenticate: unexpected,
      result: unexpected,
      downloadTasks: unexpected,
      ...extra.automation,
    },
    waitingReferenceUploads: unexpected,
    close: unexpected,
    promptOptimization: extra.optimizer?.repository ?? { begin: unexpected, finish: unexpected },
    variation: {
      config: extra.optimizer?.config ?? unexpected,
      saveAutomationPlan: extra.saveAutomationPlan ?? unexpected,
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
      userId,
      organizationId: crypto.randomUUID(),
      role: "member",
    }),
    create,
    list: unexpected,
    archive: unexpected,
    get: extra.get ?? unexpected,
    latestEdit: unexpected,
    addReference: unexpected,
    automationReferences: extra.automationReferences ?? unexpected,
    ownsAutomationReferences: extra.ownsAutomationReferences ?? unexpected,
    addAutomationReference: extra.addAutomationReference ?? unexpected,
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
    ...(extra.readDisplayThumbnail && { readDisplayThumbnail: extra.readDisplayThumbnail }),
    ...(extra.putAutomationReference && { putAutomationReference: extra.putAutomationReference }),
    remove: unexpected,
  };
  const app = createApp(() => {}, {
    auth: extra.auth,
    automationKeySecret: fixtureAutomationSecret,
    repository,
    rateLimits: extra.rateLimits,
    moderate: extra.moderate,
    billing: extra.billing,
    checkout: extra.checkout,
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
  return { create, submit, app, userId };
}

it("applies the generation budget by authenticated user before moderation or persistence", async () => {
  const blocked = vi.fn(async () => ({ success: false }));
  const moderate = vi.fn();
  const untouched = { limit: vi.fn(unexpected) };
  const { create, submit, userId } = fixture(false, false, {
    moderate,
    rateLimits: { generation: { limit: blocked }, upload: untouched, general: untouched },
  });
  const response = await submit();
  expect(response.status).toBe(429);
  expect(response.headers.get("Retry-After")).toBe("60");
  expect(await response.json()).toMatchObject({ error: { code: "RATE_LIMITED" } });
  expect(blocked).toHaveBeenCalledExactlyOnceWith({ key: userId });
  expect(untouched.limit).not.toHaveBeenCalled();
  expect(moderate).not.toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
});

it("rejects a chunked upload before reading the stream when the upload budget is exceeded", async () => {
  const blocked = vi.fn(async () => ({ success: false }));
  const untouched = { limit: vi.fn(unexpected) };
  const { app, userId } = fixture(false, false, {
    rateLimits: { generation: untouched, upload: { limit: blocked }, general: untouched },
  });
  const pull = vi.fn((controller: ReadableStreamDefaultController<Uint8Array>) =>
    controller.close(),
  );
  const request = {
    method: "POST",
    duplex: "half",
    headers: { Authorization: "Bearer fixture", "Content-Type": "image/png" },
    body: new ReadableStream({ pull }, { highWaterMark: 0 }),
  };
  expect((await app.request("/api/v1/image-assets", request)).status).toBe(429);
  expect(blocked).toHaveBeenCalledExactlyOnceWith({ key: userId });
  expect(pull).not.toHaveBeenCalled();
  expect(untouched.limit).not.toHaveBeenCalled();
});

it("rate limits authenticated task status reads without reading the database", async () => {
  const blocked = vi.fn(async () => ({ success: false }));
  const untouched = { limit: vi.fn(unexpected) };
  const { app, userId } = fixture(false, false, {
    rateLimits: { generation: untouched, upload: untouched, general: { limit: blocked } },
  });
  const path = `/api/v1/image-tasks/status?ids=${crypto.randomUUID()}`;
  expect((await app.request(path)).status).toBe(401);
  expect(blocked).not.toHaveBeenCalled();
  expect((await app.request(path, { headers: { Authorization: "Bearer fixture" } })).status).toBe(
    429,
  );
  expect(blocked).toHaveBeenCalledExactlyOnceWith({ key: userId });
  expect(untouched.limit).not.toHaveBeenCalled();
});
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
  create.mockResolvedValueOnce({
    id: crypto.randomUUID(),
    publicId: "WS8TZGMH5",
    aspectRatio: "1:1",
    replayed: true,
  });
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

it("exposes only the offer schedule to visitors and keeps checkout authenticated", async () => {
  const offerEnd = "2026-12-01T12:00:00Z";
  const { app } = fixture(false, false, {
    checkout: { offerEnd, options: unexpected, checkout: unexpected },
  });
  const response = await app.request("/api/v1/credit-pricing");
  expect(response.status).toBe(200);
  expect(unwrapApiData(await response.json())).toEqual({ offerEnd });
  expect((await app.request("/api/v1/wallet/checkout")).status).toBe(401);
  const fallback = await fixture().app.request("/api/v1/credit-pricing");
  expect(unwrapApiData(await fallback.json())).toEqual({ offerEnd: defaultCreditOfferEnd });
});

it("permits only product page paths as checkout return targets", async () => {
  const offerEnd = "2026-12-01T12:00:00Z";
  const checkout = vi.fn(async () => ({ url: "https://checkout.creem.io/fixture" }));
  const authenticate = vi.fn(async () => ({
    user: {
      userId: crypto.randomUUID(),
      organizationId: crypto.randomUUID(),
      account: "fixture",
      role: "admin" as const,
    },
    sessionId: crypto.randomUUID(),
    expiresAt: 60,
  }));
  const { app } = fixture(false, false, {
    auth: {
      config: { origins: [], secret: "fixture", secureCookie: false },
      authenticate,
    },
    checkout: { offerEnd, options: unexpected, checkout },
  });
  const submitCheckout = (returnTo: string, token = "fixture") =>
    app.request("/api/v1/wallet/checkout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ pack: "offer:trial", key: crypto.randomUUID(), returnTo }),
    });

  expect((await submitCheckout("https://checkout.example/")).status).toBe(400);
  expect((await submitCheckout("/en/login")).status).toBe(400);
  expect((await submitCheckout("/en/dashboard/video?draft=fixture")).status).toBe(400);
  expect((await submitCheckout("/en/dashboard/video", "A".repeat(43))).status).toBe(401);
  expect(checkout).not.toHaveBeenCalled();
  authenticate.mockClear();
  expect((await submitCheckout("/en/dashboard/video")).status).toBe(200);
  expect(authenticate).toHaveBeenCalledOnce();
  expect(checkout).toHaveBeenCalledWith(
    expect.any(Object),
    expect.any(String),
    "offer:trial",
    "/en/dashboard/video",
  );
});

it("returns a flat MCP authentication failure with actionable details", async () => {
  const { app } = fixture(false, false, {
    automation: {
      authenticate: async () => null,
      rotate: unexpected,
      status: unexpected,
      keyCiphertext: unexpected,
      revoke: unexpected,
      result: unexpected,
    },
  });
  const key = `lcb_img_${"A".repeat(43)}`;
  const cases = [
    { authorization: undefined, detail: "缺少 Authorization 请求头" },
    { authorization: key, detail: "Authorization 格式不正确" },
    { authorization: "Bearer wrong-format", detail: "Authorization 格式不正确" },
    { authorization: `Bearer ${key}`, detail: "生图 Key 无效、已过期或已撤销" },
  ];
  for (const { authorization, detail } of cases) {
    const response = await app.request("/api/v1/enterprise/image-api/mcp", {
      method: "POST",
      headers: authorization ? { Authorization: authorization } : {},
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      code: "UNAUTHORIZED",
      message: "请先验证身份",
      requestId: response.headers.get("X-Request-Id"),
      error: expect.stringContaining(detail),
    });
  }
});

it("limits automation credentials to enterprise image calls and serves MCP without a REST envelope", async () => {
  const key = `lcb_img_${"A".repeat(43)}`;
  const identity = {
    userId: crypto.randomUUID(),
    organizationId: crypto.randomUUID(),
    uid: "1234567890",
    role: "member" as const,
  };
  const rotate = vi.fn(async () => ({ key, expiresAt: "2027-02-01T00:00:00Z" }));
  const expiry = "2027-02-01T00:00:00Z";
  const ciphertext = await sealProviderKey(
    key,
    fixtureAutomationSecret,
    `image-automation-key:${identity.organizationId}:${identity.userId}`,
  );
  const keyCiphertext = vi.fn(async () => ciphertext);
  const origin = "https://lycobo.example";
  const { app, create } = fixture(false, false, {
    auth: {
      config: { origins: [origin], secret: "fixture", secureCookie: false },
      authenticate: async (token) => {
        if (token !== "enterprise" && token !== "personal") return null;
        return {
          user: {
            ...identity,
            account: "fixture",
            ...(token === "personal" && { loginMethod: "social" as const }),
          },
          sessionId: crypto.randomUUID(),
          expiresAt: 60,
        };
      },
    },
    automation: {
      authenticate: async (token) => (token === key ? identity : null),
      rotate,
      status: async () => ({ expiresAt: expiry, lastFour: "AAAA", copyable: true }),
      keyCiphertext,
      revoke: async () => true,
      result: async (_scope, id) => ({
        id,
        publicId: "WS8TZGMH5",
        aspectRatio: "1:1",
        status: "queued",
        asset_ids: [],
      }),
    },
  });
  const path = "/api/v1/enterprise/image-api";
  const request = (route: string, token: string, body?: object) =>
    app.request(route, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "Idempotency-Key": crypto.randomUUID(),
      },
      ...(body && { body: JSON.stringify(body) }),
    });
  expect((await request(`${path}/key`, "personal", {})).status).toBe(403);
  expect((await request(`${path}/key`, key, {})).status).toBe(401);
  expect((await request(`${path}/key/copy`, "personal", {})).status).toBe(403);
  expect((await request(`${path}/key/copy`, key, {})).status).toBe(401);
  const status = await request(`${path}/key`, "enterprise");
  expect(unwrapApiData(await status.json())).toEqual({
    expiresAt: expiry,
    lastFour: "AAAA",
    copyable: true,
  });
  expect(keyCiphertext).not.toHaveBeenCalled();
  const copyWithCookie = (requestOrigin: string) =>
    app.request(`${path}/key/copy`, {
      method: "POST",
      headers: { Cookie: "lycobo_enterprise_session=enterprise", Origin: requestOrigin },
    });
  expect((await copyWithCookie("https://other.example")).status).toBe(401);
  const copied = await copyWithCookie(origin);
  expect(copied.status).toBe(200);
  expect(copied.headers.get("Cache-Control")).toContain("no-store");
  expect(unwrapApiData(await copied.json())).toEqual({ key });
  expect(keyCiphertext).toHaveBeenCalledExactlyOnceWith(expect.objectContaining(identity));
  expect((await request("/api/v1/wallet", key)).status).toBe(401);
  const issued = await request(`${path}/key`, "enterprise", {});
  expect(issued.status).toBe(201);
  expect(rotate).toHaveBeenCalledOnce();

  const input = { prompt: "fixture", resolution: "2K" };
  expect((await request(`${path}/generations`, key, input)).status).toBe(202);
  expect(create.mock.calls[0]?.[1]).toMatchObject({ ...input, aspectRatio: "1:1", count: 1 });
  expect(create.mock.calls[0]?.[1]).not.toHaveProperty("submissionSource");
  const landscape = { ...input, aspectRatio: "16:9" };
  expect((await request(`${path}/generations`, key, { ...input, aspectRatio: "7:5" })).status).toBe(
    400,
  );
  expect((await request(`${path}/generations`, key, landscape)).status).toBe(202);
  expect(create.mock.calls[1]?.[1]).toMatchObject(landscape);
  const pending = await request(`${path}/generations/${crypto.randomUUID()}`, key);
  expect(pending.headers.get("Retry-After")).toBe("10");

  const tools = await request(`${path}/mcp`, key, { jsonrpc: "2.0", id: 1, method: "tools/list" });
  expect(await tools.json()).toMatchObject({
    jsonrpc: "2.0",
    id: 1,
    result: {
      tools: [
        { name: "prepare_reference_uploads" },
        {
          name: "generate_image",
          inputSchema: { properties: { aspectRatio: { enum: expect.arrayContaining(["16:9"]) } } },
        },
        {
          name: "generate_image_set",
          inputSchema: { properties: { aspectRatio: { enum: expect.arrayContaining(["16:9"]) } } },
        },
        { name: "prepare_task_downloads" },
        { name: "get_image" },
        { name: "preview_image" },
      ],
    },
  });
  const call = await request(`${path}/mcp`, key, {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "generate_image",
      arguments: { ...input, aspectRatio: "9:16", requestId: crypto.randomUUID() },
    },
  });
  expect(await call.json()).toMatchObject({
    jsonrpc: "2.0",
    id: 2,
    result: {
      content: [
        {
          type: "text",
          text: expect.stringContaining('"checkAtSeconds":[40,60,90],"retryAfterSeconds":40'),
        },
      ],
    },
  });
  expect(create).toHaveBeenCalledTimes(3);
  expect(create.mock.calls[2]?.[1]).toMatchObject({
    ...input,
    aspectRatio: "9:16",
    count: 1,
    submissionSource: "mcp",
  });
  const prompt = "哑光深空灰耳机，16:9 横版构图，高清质感";
  const inferred = await request(`${path}/mcp`, key, {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "generate_image",
      arguments: { ...input, prompt, requestId: crypto.randomUUID() },
    },
  });
  expect(await inferred.json()).toMatchObject({
    result: { content: [{ text: expect.stringContaining('"aspectRatio":"16:9"') }] },
  });
  expect(create.mock.calls[3]?.[1]).toMatchObject({ aspectRatio: "16:9", submissionSource: "mcp" });
  const pendingTask = await request(`${path}/mcp`, key, {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "get_image", arguments: { taskId: crypto.randomUUID() } },
  });
  expect(await pendingTask.json()).toMatchObject({
    result: { content: [{ text: expect.stringContaining('"retryAfterSeconds":20') }] },
  });
});

it("deduplicates MCP references and accepts only scoped, short-lived WebP uploads", async () => {
  const identity = {
    userId: crypto.randomUUID(),
    organizationId: crypto.randomUUID(),
    role: "member" as const,
  };
  const assetId = crypto.randomUUID();
  const newId = crypto.randomUUID();
  const known = "a".repeat(64);
  const missing = "b".repeat(64);
  const putAutomationReference = vi.fn<NonNullable<ImageStore["putAutomationReference"]>>(
    async () => ({
      id: newId,
      objectKey: "reference.webp",
      mimeType: "image/webp",
      width: 100,
      height: 100,
      bytes: 32_769,
      sha256: "c".repeat(64),
    }),
  );
  const uploaded = new Map([[known, assetId]]);
  const automationReferences = vi.fn<ImageRepository["automationReferences"]>(
    async (_scope, hashes) =>
      hashes.flatMap((sha256) => {
        const match = uploaded.get(sha256);
        return match ? [{ sha256, assetId: match }] : [];
      }),
  );
  const { app, create } = fixture(true, false, {
    putAutomationReference,
    automationReferences,
    ownsAutomationReferences: async (_scope, ids) => ids.every((id) => id === newId),
    addAutomationReference: async (_scope, sha256, asset) => {
      uploaded.set(sha256, asset.id);
      return asset.id;
    },
    automation: {
      authenticate: async (token) => (token === "fixture" ? identity : null),
      status: unexpected,
      keyCiphertext: unexpected,
      rotate: unexpected,
      revoke: unexpected,
      result: unexpected,
    },
  });
  const mcp = (name: string, args: object) =>
    app.request("/api/v1/enterprise/image-api/mcp", {
      method: "POST",
      headers: {
        Authorization: "Bearer fixture",
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    });
  const lookupResult = z.object({
    result: z.object({ content: z.array(z.object({ text: z.string() })) }),
  });
  const lookup = async () => {
    const response = await mcp("prepare_reference_uploads", { fingerprints: [known, missing] });
    const payload = lookupResult.parse(await response.json());
    return z
      .object({
        references: z.array(
          z.object({
            sha256: z.string(),
            assetId: z.string().optional(),
            uploadUrl: z.string().optional(),
            uploadToken: z.string().optional(),
          }),
        ),
      })
      .parse(JSON.parse(payload.result.content[0]?.text ?? ""));
  };
  const [hit, ticket] = (await lookup()).references;
  expect(hit).toEqual({ sha256: known, assetId });
  expect(automationReferences).toHaveBeenCalledExactlyOnceWith(
    { userId: identity.userId, organizationId: identity.organizationId },
    [known, missing],
  );
  if (!ticket?.uploadUrl || !ticket.uploadToken) throw new Error("Missing fixture upload ticket");
  const upload = (token: string, size = 32_769, contentType = "image/webp") =>
    app.request(ticket.uploadUrl ?? "", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType },
      body: new Uint8Array(size),
    });
  expect((await upload("fixture")).status).toBe(401);
  const expired = await sealProviderKey(
    JSON.stringify({
      userId: identity.userId,
      organizationId: identity.organizationId,
      sha256: missing,
      expiresAt: Date.now() - 1000,
    }),
    fixtureAutomationSecret,
    "image-automation-reference-upload:v1",
  );
  expect((await upload(expired)).status).toBe(401);
  expect((await upload(ticket.uploadToken, 32_769, "image/png")).status).toBe(400);
  expect((await upload(ticket.uploadToken, 1024 * 1024 + 1)).status).toBe(413);
  expect(putAutomationReference).not.toHaveBeenCalled();
  const saved = await upload(ticket.uploadToken);
  expect(saved.status).toBe(201);
  expect(unwrapApiData(await saved.json())).toEqual({ assetId: newId });
  expect((await upload(ticket.uploadToken)).status).toBe(200);
  expect(putAutomationReference).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ userId: identity.userId, organizationId: identity.organizationId }),
    expect.any(Uint8Array),
  );
  expect((await lookup()).references[1]).toEqual({ sha256: missing, assetId: newId });
  const generate = (referenceId: string) =>
    mcp("generate_image", {
      prompt: "fixture",
      resolution: "1.5K",
      requestId: crypto.randomUUID(),
      referenceAssetIds: [referenceId],
    });
  expect(await (await generate(crypto.randomUUID())).json()).toMatchObject({
    result: { isError: true },
  });
  expect(create).not.toHaveBeenCalled();
  expect(await (await generate(newId)).json()).toMatchObject({
    result: { content: expect.any(Array) },
  });
  expect(create.mock.calls[0]?.[1]).toMatchObject({ referenceAssetIds: [newId] });
});

it("queries task downloads in one batch and delivers completed tasks independently", async () => {
  const identity = {
    userId: crypto.randomUUID(),
    organizationId: crypto.randomUUID(),
    role: "member" as const,
  };
  const taskIds = [crypto.randomUUID(), crypto.randomUUID()];
  const pending = {
    id: taskIds[0] ?? "",
    publicId: "WS8TZGMH5",
    status: "running" as const,
    asset_ids: [],
  };
  const queued = {
    id: taskIds[1] ?? "",
    publicId: "WHIZLZ7D3",
    status: "queued" as const,
    asset_ids: [],
  };
  const assetIds = [crypto.randomUUID(), crypto.randomUUID()];
  const downloadTasks = vi
    .fn<ImageRepository["automation"]["downloadTasks"]>()
    .mockImplementation(async (scope) =>
      scope.userId === identity.userId ? [pending, queued] : [],
    );
  const assetLocations = vi.fn<ImageRepository["assetLocations"]>(async (_scope, ids) =>
    ids
      .toReversed()
      .map((id) => ({ id, objectKey: `0057849613/${identity.organizationId}/${id}.png` })),
  );
  const { app } = fixture(false, false, {
    automation: {
      authenticate: async (token) =>
        token === "owner" ? identity : { ...identity, userId: crypto.randomUUID() },
      downloadTasks,
    },
    assetLocations,
    signAsset: assetDeliverySigner(
      "https://media.example.com",
      "fixture-media-signing-key-only-0001",
    ),
  });
  const prepare = (token: string) =>
    app.request("/api/v1/enterprise/image-api/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "prepare_task_downloads", arguments: { taskIds } },
      }),
    });
  expect(await (await prepare("other")).json()).toMatchObject({ result: { isError: true } });
  const prepared = z
    .object({ result: z.object({ content: z.tuple([z.object({ text: z.string() })]) }) })
    .parse(await (await prepare("owner")).json());
  const ticket = z
    .object({
      tasks: z.array(z.object({ id: z.uuid() })),
      downloadUrl: z.url(),
      downloadToken: z.string(),
    })
    .parse(JSON.parse(prepared.result.content[0].text));
  expect(ticket.tasks.map(({ id }) => id)).toEqual(taskIds);
  const manifest = (ids = taskIds, token = ticket.downloadToken) =>
    app.request(ticket.downloadUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ taskIds: ids }),
    });
  expect((await manifest([crypto.randomUUID()])).status).toBe(403);
  expect((await manifest(taskIds, "invalid")).status).toBe(401);
  const running = await manifest();
  expect(unwrapApiData(await running.json())).toEqual({
    tasks: [
      { taskId: pending.id, status: "running" },
      { taskId: queued.id, status: "queued" },
    ],
    retryAfterSeconds: 30,
  });
  expect(assetLocations).not.toHaveBeenCalled();
  expect(downloadTasks).toHaveBeenLastCalledWith(
    expect.objectContaining({ userId: identity.userId, organizationId: identity.organizationId }),
    taskIds,
    expect.stringMatching(/^[a-f0-9]{64}$/),
  );

  downloadTasks.mockResolvedValueOnce([
    pending,
    { ...queued, status: "partially_failed", asset_ids: assetIds },
  ]);
  const complete = await manifest();
  expect(complete.status).toBe(200);
  expect(unwrapApiData(await complete.json())).toMatchObject({
    tasks: [
      { taskId: pending.id, status: "running" },
      {
        taskId: queued.id,
        status: "partially_failed",
        files: assetIds.map((assetId, index) => ({
          assetId,
          index: index + 1,
          url: expect.stringContaining(`/${assetId}.png?expires=`),
        })),
      },
    ],
  });
  expect(assetLocations).toHaveBeenCalledOnce();
  downloadTasks.mockResolvedValueOnce([]);
  expect(unwrapApiData(await (await manifest([pending.id])).json())).toMatchObject({
    tasks: [{ taskId: pending.id, status: "unavailable" }],
  });
});

it("returns owned media in task order and reads a thumbnail only when requested", async () => {
  const identity = {
    userId: crypto.randomUUID(),
    organizationId: crypto.randomUUID(),
    role: "member" as const,
  };
  const taskId = crypto.randomUUID();
  const publicId = "WS8TZGMH5";
  const assetIds = [crypto.randomUUID(), crypto.randomUUID()];
  const objectKey = (id: string) => `0057849613/${identity.organizationId}/${id}.png`;
  const assetLocations = vi.fn<ImageRepository["assetLocations"]>(async (_scope, ids) =>
    ids.toReversed().map((id) => ({ id, objectKey: objectKey(id) })),
  );
  const readDisplayThumbnail = vi.fn<NonNullable<ImageStore["readDisplayThumbnail"]>>(async () =>
    Uint8Array.of(1, 2, 3),
  );
  const { app } = fixture(false, false, {
    automation: {
      authenticate: async (token) =>
        token === "owner" ? identity : { ...identity, userId: crypto.randomUUID() },
      status: unexpected,
      keyCiphertext: unexpected,
      rotate: unexpected,
      revoke: unexpected,
      result: async (scope, id) =>
        scope.userId === identity.userId && (id === taskId || id === publicId)
          ? { id: taskId, publicId, aspectRatio: "16:9", status: "succeeded", asset_ids: assetIds }
          : null,
    },
    assetLocations,
    readDisplayThumbnail,
    signAsset: assetDeliverySigner(
      "https://media.example.test",
      "fixture-media-signing-key-only-0001",
    ),
  });
  const call = async (name: string, args: object, token = "owner") => {
    const response = await app.request("/api/v1/enterprise/image-api/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    return response.json();
  };
  expect(await call("get_image", { taskId }, "other")).toMatchObject({ result: { isError: true } });
  expect(await call("preview_image", { taskId }, "other")).toMatchObject({
    result: { isError: true },
  });
  expect(await call("preview_image", { taskId, imageIndex: 3 })).toMatchObject({
    result: { isError: true },
  });
  expect(assetLocations).not.toHaveBeenCalled();
  expect(readDisplayThumbnail).not.toHaveBeenCalled();
  const receipt = z
    .object({ result: z.object({ content: z.tuple([z.object({ text: z.string() })]) }) })
    .parse(await call("get_image", { taskId: publicId }));
  expect(JSON.parse(receipt.result.content[0].text)).toMatchObject({
    id: taskId,
    publicId,
    aspectRatio: "16:9",
    status: "succeeded",
    images: assetIds.map((id, index) => ({
      imageIndex: index + 1,
      previewUrl: expect.stringMatching(new RegExp(`${id}\\.png\\?.*variant=agent-preview`)),
      url: expect.stringMatching(new RegExp(`${id}\\.png\\?.*variant=agent-download`)),
    })),
  });
  expect(readDisplayThumbnail).not.toHaveBeenCalled();
  expect(assetLocations).toHaveBeenCalledExactlyOnceWith(identity, assetIds);
  assetLocations.mockClear();
  expect(await call("preview_image", { taskId: publicId, imageIndex: 2 })).toMatchObject({
    result: { content: [{ type: "image", mimeType: "image/webp", data: "AQID" }] },
  });
  expect(assetLocations).toHaveBeenCalledExactlyOnceWith(identity, [assetIds[1]]);
  expect(readDisplayThumbnail).toHaveBeenCalledExactlyOnceWith(objectKey(assetIds[1] ?? ""));
  readDisplayThumbnail.mockResolvedValueOnce(new Uint8Array(256 * 1024 + 1));
  expect(await call("preview_image", { taskId })).toMatchObject({ result: { isError: true } });
});

it("accepts one MCP set through moderation and the queue, with a 20-image cap per task", async () => {
  const identity = {
    userId: crypto.randomUUID(),
    organizationId: crypto.randomUUID(),
    role: "member" as const,
  };
  const planId = crypto.randomUUID();
  const referenceAssetIds = [crypto.randomUUID()];
  const saveAutomationPlan = vi.fn<ImageRepository["variation"]["saveAutomationPlan"]>(
    async (_scope, set) => ({
      id: planId,
      status: "ready",
      description: set.title,
      referenceAssetIds: set.referenceAssetIds ?? [],
      items: set.images.map((image) => ({ ...image, id: crypto.randomUUID() })),
    }),
  );
  const moderate = vi.fn<GenerationModerator>(async () => undefined);
  const { app, create } = fixture(true, false, {
    moderate,
    saveAutomationPlan,
    ownsAutomationReferences: async (_scope, ids) => ids[0] === referenceAssetIds[0],
    automation: {
      authenticate: async () => identity,
      status: unexpected,
      keyCiphertext: unexpected,
      rotate: unexpected,
      revoke: unexpected,
      result: unexpected,
    },
  });
  const images = Array.from({ length: 20 }, (_, index) => ({
    title: `图片 ${index + 1}`,
    prompt: `${index + 1} ${"窗边自然光商品图".repeat(100)}`,
  }));
  const requestId = crypto.randomUUID();
  const call = (items: typeof images) =>
    app.request("/api/v1/enterprise/image-api/mcp", {
      method: "POST",
      headers: {
        Authorization: "Bearer fixture",
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "generate_image_set",
          arguments: {
            title: "窗边商品套图",
            resolution: "2K",
            aspectRatio: "4:5",
            referenceAssetIds,
            images: items,
            requestId,
          },
        },
      }),
    });
  expect(await (await call([...images, ...images.slice(0, 1)])).json()).toMatchObject({
    result: { isError: true },
  });
  expect(saveAutomationPlan).not.toHaveBeenCalled();
  const response = await call(images);
  const job = await create.mock.results[0]?.value;
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    result: {
      content: [
        { text: expect.stringContaining(`/dashboard/commerce/smart-variation?task=${job?.id}`) },
      ],
    },
  });
  expect(saveAutomationPlan).toHaveBeenCalledWith(
    identity,
    expect.objectContaining({ images, aspectRatio: "4:5", referenceAssetIds }),
    requestId,
  );
  expect(moderate.mock.calls[0]?.[0]).toEqual(
    images.map(({ prompt }) => expect.stringContaining(prompt)),
  );
  expect(create).toHaveBeenCalledOnce();
  expect(create.mock.calls[0]?.[1]).toMatchObject({
    userPrompt: "窗边商品套图",
    aspectRatio: "4:5",
    referenceAssetIds,
    count: 20,
    submissionSource: "mcp",
    variation: { planId },
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
