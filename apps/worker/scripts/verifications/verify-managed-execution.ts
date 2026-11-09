import assert from "node:assert/strict";
import { type ImageGenerationInput, imageUnitCredits } from "@lycoboai/contracts";
import type { ImageRepository } from "@lycoboai/db";
import { sealProviderKey } from "@lycoboai/generation";
import type { ImageStore } from "@lycoboai/storage";
import type postgres from "postgres";
import {
  type ImageProcessorDependencies,
  processImageItem,
} from "../../src/images/image-processor";

export async function verifyAsyncModelExecution(
  repository: ImageRepository,
  owner: Awaited<ReturnType<ImageRepository["provision"]>>,
  input: ImageGenerationInput,
  key: string,
  png: Buffer<ArrayBufferLike>,
  store: ImageStore,
  secret: string,
  sql: postgres.Sql,
  provider: { id: string },
) {
  const idempotencyKey = crypto.randomUUID();
  const accepted = await repository.create(owner, input, idempotencyKey);
  assert.equal((await repository.wallet(owner)).balance, 200 - imageUnitCredits);
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
  await verifySurplusImageResults(repository, input, deps, png);
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
  assert.equal((await repository.wallet(owner)).balance, 200 - imageUnitCredits);
  await processImageItem(itemId, deps);
  assert.equal(posts, 1);
  assert.equal(gets, 1);
  await assert.rejects(
    repository.create(owner, input, crypto.randomUUID()),
    /MODEL_CAPABILITY_UNVERIFIED/,
  );
  assert.equal((await repository.wallet(owner)).balance, 200 - imageUnitCredits);
  const audits = await sql`select id from model_audit_events where actor_id=${owner.userId}`;
  assert(audits.length >= 4);
  return deps;
}

async function verifySurplusImageResults(
  repository: ImageRepository,
  input: ImageGenerationInput,
  deps: ImageProcessorDependencies,
  png: Buffer,
) {
  const surplusOwner = await repository.provision(
    `surplus-${crypto.randomUUID()}`,
    "surplus-fixture",
    imageUnitCredits,
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
}
