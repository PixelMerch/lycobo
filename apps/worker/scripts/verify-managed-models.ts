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
    (await repository.models.logos()).models.find((m) => m.id === "nano-banana-2.1")?.logoUrl,
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
  await sql`delete from model_routes where channel_id=${textileChannel.id}`;
  // Subsequent integration cases must retain their original routing policy.
  await sql`delete from model_routes where channel_id=${channel.id}`;
  console.info(
    "Managed model API separation, encrypted keys, route snapshots, async submit/poll, wallet idempotency and legacy fallback passed (fixture only)",
  );
}
