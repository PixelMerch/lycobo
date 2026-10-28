import assert from "node:assert/strict";
import { imageGenerationInputSchema } from "@lycoboai/contracts";
import type { ImageRepository } from "@lycoboai/db";
import {
  normalizeTextileGeneration,
  sealProviderKey,
  supportedResolutions,
  validateModelInput,
} from "@lycoboai/generation";
import type { ImageStore } from "@lycoboai/storage";
import type postgres from "postgres";
import { createApp } from "../../api/src/app";
import { processImageItem } from "../src/image-processor";
export async function verifyManagedModels(
  repository: ImageRepository,
  sql: postgres.Sql,
  store: ImageStore,
  png: Buffer,
) {
  await sql`update model_catalog set logo_url='https://logos.example.com/image2.webp' where code='gpt-image-2'`;
  const logos = await repository.models.logos();
  if (
    logos.models.find((m) => m.id === "gpt-image-2")?.logoUrl !==
    "https://logos.example.com/image2.webp"
  )
    throw new Error("Configured model logo was not exposed");
  if (
    logos.models.some((m) =>
      Object.keys(m).some(
        (key) => !["id", "logoUrl", "name", "description", "capabilitySummary"].includes(key),
      ),
    )
  )
    throw new Error("Provider configuration leaked through model logos");
  await sql`insert into model_catalog(code,name,category,logo_url,enabled) values ('gemini-3.1-flash-image-preview','Banana fixture','image','https://logos.example.com/banana.webp',1)`;
  assert.equal(
    (await repository.models.logos()).models.find((m) => m.id === "gemini-3.1-flash-image-preview")
      ?.logoUrl,
    "https://logos.example.com/banana.webp",
  );
  await sql`update model_catalog set logo_url='https://logos.example.com/canonical.webp' where code='nano-banana-2.1'`;
  assert.equal(
    (await repository.models.logos()).models.find((m) => m.id === "nano-banana-2.1")?.logoUrl,
    "https://logos.example.com/canonical.webp",
  );
  await sql`update model_catalog set name='目录显示名称',description='后台介绍',capability_summary='后台能力' where code='gpt-image-2'`;
  assert.deepEqual(
    (await repository.models.logos()).models.find((m) => m.id === "gpt-image-2"),
    {
      id: "gpt-image-2",
      name: "目录显示名称",
      logoUrl: "https://logos.example.com/image2.webp",
      description: "后台介绍",
      capabilitySummary: "后台能力",
    },
  );
  await sql`update model_catalog set sort_order=-10 where code='gpt-image-2.5'`;
  assert.equal((await repository.models.logos()).models[0]?.id, "gpt-image-2.5");
  const owner = await repository.provision(
    `managed-${crypto.randomUUID()}`,
    "managed-fixture",
    200,
  );
  const secret = Buffer.alloc(32, 7).toString("base64");
  const key = "fixture-upstream-key";
  const provider = await repository.models.saveProvider(
    owner.userId,
    undefined,
    {
      name: "Fixture provider",
      origin: "https://provider.example.com",
      adapter: "fluxport-images",
      enabled: true,
    },
    await sealProviderKey("fixture-provider-default-key", secret),
  );
  const channel = await repository.models.saveChannel(owner.userId, undefined, {
    name: "Fixture channel",
    providerId: provider.id,
    model: "gpt-image-2",
    upstreamModel: "fixture-upstream",
    mode: "async-preferred",
    enabled: true,
    editsEnabled: true,
    resolutions: ["1K"],
    maxReferences: 6,
    timeoutMs: 5000,
    taskTimeoutSeconds: 600,
    downloadOrigins: [],
  });
  // The selected channel key, rather than the provider default, is snapshotted.
  const [credential] =
    await sql`insert into model_credentials(ciphertext) values (${await sealProviderKey(key, secret)}) returning id`;
  assert(credential);
  const [channelKey] =
    await sql`insert into model_provider_keys(provider_id,credential_id,name,enabled) values (${provider.id},${credential.id},'Channel fixture key',1) returning id`;
  assert(channelKey);
  await sql`update model_channels set key_id=${channelKey.id} where id=${channel.id}`;
  await repository.models.saveRoute(owner.userId, {
    tool: "create",
    model: "gpt-image-2",
    channelId: channel.id,
  });
  const app = createApp(() => {}, {
    repository,
    modelSecret: secret,
    store,
    enabled: true,
    editsEnabled: true,
    unitCredits: 20,
    validate: (i) => validateModelInput(i, {}, true),
    resolutions: supportedResolutions,
  });
  // Management is owned by the independent admin API, even for business administrators.
  assert.equal(
    (
      await app.request("/api/v1/model-management", {
        headers: { Authorization: `Bearer ${owner.token}` },
      })
    ).status,
    404,
  );
  await sql`insert into model_catalog(code,name,category,enabled) values ('custom-image-v7','新图片模型','image',1),('hidden-image','未启用','image',0),('custom-video','视频','video',1)`;
  const publicCatalog = (await repository.models.logos()).models;
  assert(publicCatalog.some((model) => model.id === "custom-image-v7"));
  assert(!publicCatalog.some((model) => ["hidden-image", "custom-video"].includes(model.id)));
  const customInput = imageGenerationInputSchema.parse({
    model: "custom-image-v7",
    prompt: "fixture",
  });
  await assert.rejects(
    repository.create(owner, customInput, crypto.randomUUID()),
    /MODEL_CAPABILITY_UNVERIFIED/,
  );
  const customChannel = await repository.models.saveChannel(owner.userId, undefined, {
    name: "Dynamic channel",
    providerId: provider.id,
    model: "custom-image-v7",
    upstreamModel: "custom-provider-v7",
    mode: "async-preferred",
    enabled: true,
    editsEnabled: true,
    resolutions: ["2K"],
    maxReferences: 6,
    timeoutMs: 5000,
    taskTimeoutSeconds: 600,
    downloadOrigins: [],
  });
  await repository.models.saveRoute(owner.userId, {
    tool: "create",
    model: "custom-image-v7",
    channelId: customChannel.id,
  });
  assert(
    (await repository.models.capabilities()).create?.some(
      (model) => model.id === "custom-image-v7" && model.enabledResolutions.includes("2K"),
    ),
  );
  const customOwner = await repository.provision(
    `dynamic-${crypto.randomUUID()}`,
    "dynamic-fixture",
    20,
  );
  const dynamicTask = await repository.create(
    customOwner,
    { ...customInput, resolution: "2K" },
    crypto.randomUUID(),
  );
  const resolutionOwner = await repository.provision(
    `all-resolutions-${crypto.randomUUID()}`,
    "resolution-fixture",
    40,
  );
  assert.deepEqual(
    (await repository.models.capabilities()).create?.find((model) => model.id === "custom-image-v7")
      ?.enabledResolutions,
    ["1K", "2K", "4K"],
  );
  for (const resolution of ["1K", "4K"] as const) {
    const created = await repository.create(
      resolutionOwner,
      { ...customInput, resolution },
      crypto.randomUUID(),
      20,
      true,
    );
    const [stored] =
      await sql`select resolution,provider_snapshot from generation_jobs where id=${created.id}`;
    assert.equal(stored?.resolution, resolution);
    assert.deepEqual(stored?.provider_snapshot.resolutions, ["1K", "2K", "4K"]);
  }
  const [dynamicSnapshot] =
    await sql`select provider_snapshot from generation_jobs where id=${dynamicTask.id}`;
  assert.equal(dynamicSnapshot?.provider_snapshot.upstreamModel, "custom-provider-v7");
  const legacyOwner = await repository.provision(
    `legacy-upgrade-${crypto.randomUUID()}`,
    "legacy-fixture",
    40,
  );
  const legacyInput = imageGenerationInputSchema.parse({
    model: "gpt-image-2.5",
    prompt: "fixture",
  });
  const legacyJob = await repository.create(legacyOwner, legacyInput, crypto.randomUUID());
  const legacyItem = (await repository.get(legacyOwner, legacyJob.id))?.items[0];
  assert(legacyItem);
  const claimed = await repository.claim(legacyItem.id, "legacy-fixture", 10000);
  assert(claimed);
  await repository.finish(claimed, { errorCode: "PROVIDER_HTTP_400", unknown: false });
  const retryKey = crypto.randomUUID();
  await assert.rejects(
    repository.retry(legacyOwner, legacyJob.id, retryKey, undefined, true),
    /MODEL_CAPABILITY_UNVERIFIED/,
  );
  assert.equal((await repository.wallet(legacyOwner)).balance, 40);
  const replacement = await repository.models.saveChannel(owner.userId, undefined, {
    name: "Legacy replacement",
    providerId: provider.id,
    model: "gpt-image-2.5",
    upstreamModel: "new-managed-image",
    mode: "async-preferred",
    enabled: true,
    editsEnabled: true,
    resolutions: ["1K"],
    maxReferences: 6,
    timeoutMs: 5000,
    taskTimeoutSeconds: 600,
    downloadOrigins: [],
  });
  await repository.models.saveRoute(owner.userId, {
    tool: "create",
    model: "gpt-image-2.5",
    channelId: replacement.id,
  });
  await repository.retry(legacyOwner, legacyJob.id, retryKey, undefined, true);
  assert.equal(
    (await repository.retry(legacyOwner, legacyJob.id, retryKey, undefined, true)).replayed,
    true,
  );
  assert.equal((await repository.wallet(legacyOwner)).balance, 20);
  const [upgraded] =
    await sql`select provider_snapshot from generation_jobs where id=${legacyJob.id}`;
  assert.equal(upgraded?.provider_snapshot.upstreamModel, "new-managed-image");
  await sql`delete from model_routes where channel_id=${replacement.id}`;
  const input = imageGenerationInputSchema.parse({ model: "gpt-image-2", prompt: "fixture" });
  await sql`update model_provider_keys set enabled=0 where id=${channelKey.id}`;
  await assert.rejects(
    repository.create(owner, input, crypto.randomUUID()),
    /MODEL_CAPABILITY_UNVERIFIED/,
  );
  assert.equal((await repository.wallet(owner)).balance, 200);
  await sql`update model_provider_keys set enabled=1 where id=${channelKey.id}`;
  await sql`update model_catalog set enabled=0 where code='gpt-image-2'`;
  await assert.rejects(
    repository.create(owner, input, crypto.randomUUID()),
    /MODEL_CAPABILITY_UNVERIFIED/,
  );
  assert.equal((await repository.wallet(owner)).balance, 200);
  await sql`update model_catalog set enabled=1 where code='gpt-image-2'`;
  const idempotencyKey = crypto.randomUUID();
  const accepted = await repository.create(owner, input, idempotencyKey);
  assert.equal((await repository.wallet(owner)).balance, 180);
  let posts = 0,
    gets = 0;
  const request: typeof fetch = async (_url, init) => {
    assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${key}`);
    if (init?.method === "POST") {
      posts++;
      assert.equal(JSON.parse(String(init.body)).model, "fixture-upstream");
      return Response.json(
        {
          task_id: "fixture-task",
          status: "queued",
          status_url: "/v1/images/tasks/fixture-task?view=summary",
          poll_after_ms: 2000,
        },
        { status: 202 },
      );
    }
    gets++;
    return Response.json({
      task_id: "fixture-task",
      status: "success",
      assets: [{ b64_json: png.toString("base64") }],
    });
  };
  const raw = await repository.get(owner, accepted.id);
  const itemId = String(raw?.items?.[0]?.id);
  assert(itemId && itemId !== "undefined");
  const deps = {
    repository,
    store,
    workerId: "managed-fixture",
    modelSecret: secret,
    provider: { key: "unused", baseUrl: "https://unused.example.com", timeoutMs: 5000 },
    overrides: {},
    editsEnabled: true,
    request,
  };
  await processImageItem(itemId, deps);
  assert.equal(posts, 1);
  assert.equal((await repository.get(owner, accepted.id))?.status, "running");
  await processImageItem(itemId, deps);
  assert.equal(posts, 1);
  assert.equal(gets, 0);
  // A worker restart during a read must resume GET, never retire or resubmit paid work.
  await sql`update provider_executions set next_poll_at=now()-interval '1 second' where item_id=${itemId}`;
  const interruptedPoll = await repository.claim(itemId, "interrupted-fixture", 10000);
  assert(interruptedPoll);
  assert.equal(
    (await repository.leaseOutbox()).some((entry) => entry.itemId === itemId),
    false,
    "Active poll leases must suppress duplicate dispatch",
  );
  await sql`update provider_executions set lease_until=now()-interval '1 second' where item_id=${itemId}`;
  await sql`update generation_job_items set lease_expires_at=now()-interval '1 second' where id=${itemId}`;
  await repository.expireClaims();
  assert.equal(
    (await repository.get(owner, accepted.id))?.status,
    "running",
    "An interrupted known poll must remain recoverable",
  );

  // The upstream may return surplus images despite n=1. Deliver one result per paid slot.
  const surplusOwner = await repository.provision(
    `surplus-${crypto.randomUUID()}`,
    "surplus-fixture",
    20,
  );
  const surplusJob = await repository.create(surplusOwner, input, crypto.randomUUID(), 20, true);
  const surplusItem = (await repository.get(surplusOwner, surplusJob.id))?.items[0];
  assert(surplusItem);
  let surplusPosts = 0;
  await processImageItem(surplusItem.id, {
    ...deps,
    request: async (_url, init) => {
      assert.equal(init?.method, "POST");
      assert.equal(JSON.parse(String(init.body)).n, 1);
      surplusPosts++;
      return Response.json({
        data: Array.from({ length: 3 }, () => ({ b64_json: png.toString("base64") })),
      });
    },
  });
  assert.equal(
    (await repository.get(surplusOwner, surplusJob.id))?.status,
    "succeeded",
    "Surplus provider output must not discard a usable image",
  );
  assert.equal((await repository.wallet(surplusOwner)).balance, 0);
  assert.equal(surplusPosts, 1);
  await processImageItem(surplusItem.id, deps);
  assert.equal(surplusPosts, 1);
  // Credentials and channel configuration are versioned: in-flight work keeps its accepted route.
  await repository.models.saveProvider(
    owner.userId,
    provider.id,
    {
      name: "Renamed provider",
      origin: "https://changed.example.com",
      adapter: "openai-images",
      enabled: false,
    },
    await sealProviderKey("rotated-fixture-key", secret),
  );
  assert.equal((await repository.create(owner, input, idempotencyKey)).replayed, true);
  await sql`update provider_executions set next_poll_at=now()-interval '1 second' where item_id=${itemId}`;
  await processImageItem(itemId, deps);
  assert.equal(posts, 1);
  assert.equal(gets, 1);
  assert.equal((await repository.get(owner, accepted.id))?.status, "succeeded");
  assert.equal(
    await repository.finish(interruptedPoll, { errorCode: "STALE_POLL", unknown: true }),
    false,
  );
  assert.equal((await repository.get(owner, accepted.id))?.status, "succeeded");
  assert.equal((await repository.wallet(owner)).balance, 180);
  await processImageItem(itemId, deps);
  assert.equal(posts, 1);
  assert.equal(gets, 1);
  await assert.rejects(
    repository.create(owner, input, crypto.randomUUID()),
    /MODEL_CAPABILITY_UNVERIFIED/,
  );
  assert.equal((await repository.wallet(owner)).balance, 180);
  const audits = await sql`select id from model_audit_events where actor_id=${owner.userId}`;
  assert(audits.length >= 4);
  // v5 must never silently fall back to legacy model aliases when a route is absent.
  const reference = await store.put(owner, png);
  await repository.addReference(owner, reference);
  const textile = normalizeTextileGeneration(
    imageGenerationInputSchema.parse({
      model: "gpt-image-2.5",
      prompt: "fixture",
      count: 2,
      referenceAssetIds: [reference.id],
      textileSet: { version: 5, views: ["front", "pillow"] },
    }),
  );
  await assert.rejects(
    repository.create(owner, textile, crypto.randomUUID()),
    /MODEL_CAPABILITY_UNVERIFIED/,
  );
  assert.equal((await repository.wallet(owner)).balance, 180);
  await repository.models.saveProvider(
    owner.userId,
    provider.id,
    {
      name: "Restored provider",
      origin: "https://provider.example.com",
      adapter: "fluxport-images",
      enabled: true,
    },
    await sealProviderKey(key, secret),
  );
  const textileChannel = await repository.models.saveChannel(owner.userId, undefined, {
    name: "Textile v5",
    providerId: provider.id,
    model: "gpt-image-2.5",
    upstreamModel: "gpt-image-2.5",
    mode: "async-preferred",
    enabled: true,
    editsEnabled: true,
    resolutions: ["1K"],
    maxReferences: 6,
    timeoutMs: 5000,
    taskTimeoutSeconds: 1800,
    downloadOrigins: [],
  });
  await repository.models.saveRoute(owner.userId, {
    tool: "textile-set",
    model: "gpt-image-2.5",
    channelId: textileChannel.id,
  });
  const textileKey = crypto.randomUUID();
  const textileJob = await repository.create(owner, textile, textileKey);
  assert.equal((await repository.create(owner, textile, textileKey)).replayed, true);
  assert.equal((await repository.wallet(owner)).balance, 140);
  const textileItems = (await repository.get(owner, textileJob.id))?.items ?? [];
  let textilePosts = 0,
    textilePolls = 0;
  const textileRequest: typeof fetch = async (url, init) => {
    if (init?.method === "POST") {
      textilePosts++;
      const payload = JSON.parse(String(init.body));
      assert.equal(payload.model, "gpt-image-2.5");
      assert.equal(payload.n, 1);
      assert.equal(payload.async, true);
      assert.equal(payload.images.length, 1);
      assert(String(url).endsWith("/v1/images/edits"));
      return Response.json(
        {
          task_id: `textile-${textilePosts}`,
          status: "running",
          status_url: `/v1/images/tasks/textile-${textilePosts}?view=summary`,
          poll_after_ms: 2000,
        },
        { status: 202, headers: { "x-request-id": `fixture-submit-${textilePosts}` } },
      );
    }
    textilePolls++;
    return Response.json({
      status: "success",
      auto_poll: false,
      data: [],
      assets: [{ b64_json: png.toString("base64") }],
    });
  };
  for (const item of textileItems) {
    const id = String(item.id);
    await processImageItem(id, { ...deps, request: textileRequest });
    await processImageItem(id, { ...deps, request: textileRequest });
  }
  assert.equal(textilePosts, 2);
  assert.equal(textilePolls, 0);
  for (const item of textileItems) {
    const id = String(item.id);
    await sql`update provider_executions set next_poll_at=now()-interval '1 second' where item_id=${id}`;
    await processImageItem(id, { ...deps, request: textileRequest });
    await processImageItem(id, { ...deps, request: textileRequest });
  }
  assert.equal(textilePosts, 2);
  assert.equal(textilePolls, 2);
  assert.equal((await repository.get(owner, textileJob.id))?.status, "succeeded");
  assert.equal((await repository.wallet(owner)).balance, 140);
  const traced =
    await sql`select provider,provider_request_id from generation_job_items where job_id=${textileJob.id}`;
  assert(
    traced.every(
      (item) =>
        item.provider === "fluxport-images" &&
        String(item.provider_request_id).startsWith("fixture-submit-"),
    ),
  );
  const geminiOwner = await repository.provision(
    `gemini-${crypto.randomUUID()}`,
    "gemini-fixture",
    40,
  );
  const geminiSettings = {
    name: "Gemini fixture",
    providerId: provider.id,
    model: "gemini-3.1-flash-image-preview",
    upstreamModel: "gemini-3.1-flash-image-preview",
    adapter: "gemini-native",
    mode: "provider-default",
    enabled: true,
    editsEnabled: true,
    maxReferences: 5,
    timeoutMs: 5000,
    taskTimeoutSeconds: 600,
    downloadOrigins: [],
  };
  const geminiChannel = await repository.models.saveChannel(
    owner.userId,
    undefined,
    geminiSettings,
  );
  await repository.models.saveRoute(owner.userId, {
    tool: "create",
    model: geminiSettings.model,
    channelId: geminiChannel.id,
  });
  // Definitively failed old-protocol jobs adopt current routing only on explicit retry.
  const protocolOwner = await repository.provision(
    `protocol-retry-${crypto.randomUUID()}`,
    "protocol-fixture",
    40,
  );
  await repository.models.saveChannel(owner.userId, geminiChannel.id, {
    ...geminiSettings,
    adapter: "fluxport-images",
  });
  const protocolInput = imageGenerationInputSchema.parse({
    model: geminiSettings.model,
    prompt: "fixture",
  });
  const protocolJob = await repository.create(
    protocolOwner,
    protocolInput,
    crypto.randomUUID(),
    20,
    true,
  );
  const protocolItem = (await repository.get(protocolOwner, protocolJob.id))?.items[0];
  assert(protocolItem);
  const protocolClaim = await repository.claim(protocolItem.id, "old-protocol-fixture", 10000);
  assert(protocolClaim);
  await repository.finish(protocolClaim, { errorCode: "PROVIDER_HTTP_400", unknown: false });
  await repository.models.saveChannel(owner.userId, geminiChannel.id, geminiSettings);
  const protocolRetryKey = crypto.randomUUID();
  await repository.retry(protocolOwner, protocolJob.id, protocolRetryKey, undefined, true);
  const [retriedProtocol] =
    await sql`select provider_snapshot from generation_jobs where id=${protocolJob.id}`;
  assert.equal(
    retriedProtocol?.provider_snapshot.adapter,
    "gemini-native",
    "Explicit retry must replace obsolete protocol for fully failed jobs",
  );
  const [oldProtocolEvidence] =
    await sql`select reconciliation_evidence from generation_job_items where id=${protocolItem.id}`;
  assert.match(String(oldProtocolEvidence?.reconciliation_evidence), /fluxport-images/);
  assert.equal(
    (await repository.retry(protocolOwner, protocolJob.id, protocolRetryKey, undefined, true))
      .replayed,
    true,
  );
  assert.equal((await repository.wallet(protocolOwner)).balance, 20);
  const retriedProtocolItem = (await repository.get(protocolOwner, protocolJob.id))?.items[0];
  assert(retriedProtocolItem);
  await processImageItem(retriedProtocolItem.id, {
    ...deps,
    request: async (url, init) => {
      assert.equal(init?.method, "POST");
      assert.match(String(url), /:generateContent$/);
      return Response.json({
        candidates: [
          {
            content: {
              parts: [{ inlineData: { mimeType: "image/png", data: png.toString("base64") } }],
            },
          },
        ],
      });
    },
  });
  assert.equal((await repository.get(protocolOwner, protocolJob.id))?.status, "succeeded");
  const geminiReference = await store.put(geminiOwner, png);
  await repository.addReference(geminiOwner, geminiReference);
  for (const asyncMode of [false, true]) {
    const nativeInput = imageGenerationInputSchema.parse({
      model: geminiSettings.model,
      prompt: "fixture",
      resolution: "4K",
      referenceAssetIds: [geminiReference.id],
    });
    const nativeJob = await repository.create(
      geminiOwner,
      nativeInput,
      crypto.randomUUID(),
      20,
      true,
    );
    const nativeItem = (await repository.get(geminiOwner, nativeJob.id))?.items[0];
    assert(nativeItem);
    let nativePosts = 0;
    let nativeGets = 0;
    const nativeRequest: typeof fetch = async (url, init) => {
      if (init?.method === "POST") {
        nativePosts++;
        assert(
          String(url).endsWith("/v1beta/models/gemini-3.1-flash-image-preview:generateContent"),
        );
        const payload = JSON.parse(String(init.body));
        assert.equal(payload.generationConfig.imageConfig.imageSize, "4K");
        assert.equal(payload.contents[0].parts[1].inlineData.data, png.toString("base64"));
        assert.equal(payload.n, undefined);
        if (asyncMode)
          return Response.json(
            {
              task_id: "gemini-native-fixture",
              status: "queued",
              status_url: "/v1/images/tasks/gemini-native-fixture?view=summary",
            },
            { status: 202 },
          );
      } else nativeGets++;
      return Response.json({
        candidates: [
          {
            content: {
              parts: [{ inlineData: { mimeType: "image/png", data: png.toString("base64") } }],
            },
          },
        ],
      });
    };
    await processImageItem(nativeItem.id, { ...deps, request: nativeRequest });
    if (asyncMode) {
      // Changing channel protocol cannot change an accepted task's protocol snapshot.
      await repository.models.saveChannel(owner.userId, geminiChannel.id, {
        ...geminiSettings,
        adapter: "openai-images",
      });
      await sql`update provider_executions set next_poll_at=now()-interval '1 second' where item_id=${nativeItem.id}`;
      await processImageItem(nativeItem.id, { ...deps, request: nativeRequest });
    }
    await processImageItem(nativeItem.id, { ...deps, request: nativeRequest });
    assert.equal(nativePosts, 1);
    assert.equal(nativeGets, asyncMode ? 1 : 0);
    assert.equal((await repository.get(geminiOwner, nativeJob.id))?.status, "succeeded");
    const [nativeSnapshot] =
      await sql`select provider_snapshot from generation_jobs where id=${nativeJob.id}`;
    assert.equal(nativeSnapshot?.provider_snapshot.adapter, "gemini-native");
  }
  assert.equal((await repository.wallet(geminiOwner)).balance, 0);
  for (const upstreamModel of ["grok-imagine-image-2.0", "seedream-5.0-pro"]) {
    const grokModel = `managed-${upstreamModel}`;
    await sql`insert into model_catalog(code,name,category,enabled) values (${grokModel},'Grok fixture','image',1)`;
    const grokOwner = await repository.provision(`grok-${crypto.randomUUID()}`, "grok-fixture", 40);
    const grokChannel = await repository.models.saveChannel(owner.userId, undefined, {
      ...geminiSettings,
      name: "Grok fixture",
      model: grokModel,
      upstreamModel,
      adapter: "fluxport-images",
      mode: "async-preferred",
      maxReferences: 1,
    });
    await repository.models.saveRoute(owner.userId, {
      tool: "create",
      model: grokModel,
      channelId: grokChannel.id,
    });
    const grokReference = await store.put(grokOwner, png);
    await repository.addReference(grokOwner, grokReference);
    for (const edit of [false, true]) {
      const grokInput = imageGenerationInputSchema.parse({
        model: grokModel,
        prompt: "fixture",
        referenceAssetIds: edit ? [grokReference.id] : [],
      });
      const grokJob = await repository.create(grokOwner, grokInput, crypto.randomUUID(), 20, true);
      const grokItem = (await repository.get(grokOwner, grokJob.id))?.items[0];
      assert(grokItem);
      let posts = 0;
      let gets = 0;
      const request: typeof fetch = async (url, init) => {
        if (init?.method === "POST") {
          posts++;
          assert(String(url).endsWith(edit ? "/v1/images/edits" : "/v1/images/generations"));
          const payload = JSON.parse(String(init.body));
          assert.equal(payload.model, upstreamModel);
          assert.equal(payload.quality, undefined);
          assert.equal(payload.n, 1);
          if (edit) {
            assert.equal(
              payload.images[0].image_url,
              `data:image/png;base64,${png.toString("base64")}`,
            );
            return Response.json(
              {
                task_id: "grok-fixture",
                status: "queued",
                status_url: "/v1/images/tasks/grok-fixture?view=summary",
              },
              { status: 202 },
            );
          }
        } else gets++;
        return Response.json({ data: [{ b64_json: png.toString("base64") }] });
      };
      await processImageItem(grokItem.id, { ...deps, request });
      if (edit) {
        await sql`update provider_executions set next_poll_at=now()-interval '1 second' where item_id=${grokItem.id}`;
        await processImageItem(grokItem.id, { ...deps, request });
      }
      await processImageItem(grokItem.id, { ...deps, request });
      assert.equal(posts, 1);
      assert.equal(gets, edit ? 1 : 0);
      assert.equal((await repository.get(grokOwner, grokJob.id))?.status, "succeeded");
    }
    assert.equal((await repository.wallet(grokOwner)).balance, 0);
    await sql`delete from model_routes where channel_id=${grokChannel.id}`;
  }

  await sql`delete from model_routes where channel_id=${geminiChannel.id}`;
  await sql`delete from model_routes where channel_id=${textileChannel.id}`;
  // Subsequent integration cases must retain their original routing policy.
  await sql`delete from model_routes where channel_id=${channel.id}`;
  console.info(
    "Managed model API separation, encrypted keys, route snapshots, async submit/poll, wallet idempotency and legacy fallback passed (fixture only)",
  );
}
