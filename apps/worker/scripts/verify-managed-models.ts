import assert from "node:assert/strict";
import { imageGenerationInputSchema } from "@lycoboai/contracts";
import type { ImageRepository } from "@lycoboai/db";
import { sealProviderKey, supportedResolutions, validateModelInput } from "@lycoboai/generation";
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
  const owner = await repository.provision(
    `managed-${crypto.randomUUID()}`,
    "managed-fixture",
    200,
  );
  const other = await repository.provision(
    `managed-other-${crypto.randomUUID()}`,
    "other-fixture",
    100,
  );
  await sql`insert into platform_administrators(user_id) values (${owner.userId})`;
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
    await sealProviderKey(key, secret),
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
  const path = "/api/v1/model-management";
  assert.equal((await app.request(path)).status, 401);
  assert.equal(
    (await app.request(path, { headers: { Authorization: `Bearer ${other.token}` } })).status,
    403,
  );
  const view = await app.request(path, { headers: { Authorization: `Bearer ${owner.token}` } });
  assert.equal(view.status, 200);
  assert(!JSON.stringify(await view.json()).includes(key));
  const input = imageGenerationInputSchema.parse({ model: "gpt-image-2", prompt: "fixture" });
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
  // Subsequent integration cases must retain their original routing policy.
  await sql`delete from model_routes where channel_id=${channel.id}`;
  console.info(
    "Managed model RBAC, encrypted keys, route snapshots, async submit/poll, wallet idempotency and legacy fallback passed (fixture only)",
  );
}
