import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { imageGenerationInputSchema } from "@lycoboai/contracts";
import {
  CloudBaseOperationError,
  type CloudBaseRpc,
  cloudbaseImageEventFeed,
  cloudbaseImageRepository,
  openImageRepository,
} from "@lycoboai/db";
import { standaloneModels } from "@lycoboai/generation";
import postgres from "postgres";
import { z } from "zod";

if (process.env.ALLOW_LOCAL_INTEGRATION !== "true")
  throw new Error("Explicit isolated test opt-in required");
const base = new URL(process.env.DATABASE_URL ?? "");
if (
  !["postgres:", "postgresql:"].includes(base.protocol) ||
  !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)
)
  throw new Error("Only loopback PostgreSQL allowed");
const admin = postgres(base.href, { max: 1 });
const dbName = `cloudbase_images_${randomUUID().replaceAll("-", "")}`;
const url = new URL(base);
url.pathname = `/${dbName}`;
const sql = postgres(url.href, { max: 5 });
const native = openImageRepository(url.href);
try {
  await admin.unsafe(`create database "${dbName}"`);
  const migration = spawnSync("pnpm", ["--filter", "@lycoboai/db", "db:migrate"], {
    cwd: fileURLToPath(new URL("../../../", import.meta.url).href),
    env: { ...process.env, DATABASE_URL: url.href },
    stdio: "pipe",
  });
  if (migration.status !== 0) throw new Error("Isolated migration failed");
  for (const role of ["anon", "authenticated", "service_role"]) {
    await sql.unsafe(
      `DO $$ BEGIN CREATE ROLE ${role}; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    );
  }
  const migrations = new URL("../../../cloudbase/migrations/", import.meta.url);
  for (const migration of (await readdir(fileURLToPath(migrations.href)))
    .filter((name) => name.endsWith(".sql") && name >= "20261031223500")
    .sort()) {
    await sql.unsafe(await readFile(fileURLToPath(new URL(migration, migrations).href), "utf8"));
  }
  const call: CloudBaseRpc = async (operation, parameters) => {
    if (operation === "lycobo_image_batch") {
      const a = z
        .object({ p_org: z.string(), p_user: z.string(), p_ids: z.array(z.string()) })
        .parse(parameters);
      const [row] =
        await sql`select public.lycobo_image_batch(${a.p_org}::uuid,${a.p_user}::uuid,${a.p_ids}::uuid[]) result`;
      return row?.result;
    }
    assert(["lycobo_image_operation", "lycobo_provider_webhook"].includes(operation));
    const args = z
      .object({ p_operation: z.string(), p_args: z.record(z.string(), z.unknown()) })
      .parse(parameters);
    try {
      if (operation === "lycobo_provider_webhook") {
        const [row] =
          await sql`select public.lycobo_provider_webhook(${args.p_operation},${sql.json(z.json().parse(JSON.parse(JSON.stringify(args.p_args))))}) result`;
        return row?.result;
      }
      const [row] =
        await sql`select public.lycobo_image_operation(${args.p_operation},${sql.json(z.json().parse(JSON.parse(JSON.stringify(args.p_args))))}) result`;
      return row?.result;
    } catch (error) {
      if (error instanceof postgres.PostgresError && error.code === "P0001")
        throw new CloudBaseOperationError(error.message);
      throw error;
    }
  };
  const config = await standaloneModels({
    STANDALONE_MODELS: "true",
    STANDALONE_IMAGE_API_KEY: "fixture-only",
    DEEPSEEK_API_KEY: "fixture-only",
  });
  if (!config) throw new Error("Fixture config missing");
  const repository = cloudbaseImageRepository(call, config);
  const scope = await native.provision(`cloudbase-images:${randomUUID()}`, "RPC fixture", 20);
  const stranger = await native.provision(`cloudbase-images:${randomUUID()}`, "Other fixture", 0);
  assert.equal(await repository.storageUid(scope), scope.uid);
  assert.equal((await repository.authenticate(scope.token))?.organizationId, scope.organizationId);
  const input = imageGenerationInputSchema.parse({
    model: "gpt-image-2",
    prompt: "CloudBase isolated fixture",
    resolution: "2K",
    aspectRatio: "1:1",
    count: 2,
    referenceAssetIds: [],
  });
  const key = randomUUID();
  const jobs = await Promise.all([
    repository.create(scope, input, key),
    repository.create(scope, input, key),
  ]);
  const disabledRouting = cloudbaseImageRepository(call, {
    ...config,
    resolve: () => {
      throw new Error("MODEL_CHANNEL_DISABLED");
    },
  });
  assert.equal((await disabledRouting.create(scope, input, key)).replayed, true);
  await assert.rejects(disabledRouting.create(scope, input, randomUUID()), {
    code: "MODEL_CAPABILITY_UNVERIFIED",
  });
  assert.equal(jobs[0]?.id, jobs[1]?.id);
  assert.equal(jobs.filter((j) => j.replayed === false).length, 1);
  assert.equal((await repository.wallet(scope)).balance, 16);
  await assert.rejects(repository.create(stranger, { ...input, count: 1 }, randomUUID()), {
    code: "INSUFFICIENT_CREDITS",
  });
  assert.equal((await repository.list(stranger, 10)).length, 0);
  const jobId = jobs[0]?.id;
  if (!jobId) throw new Error("Job missing");
  assert.equal(await repository.get(stranger, jobId), null);
  await assert.rejects(repository.create(scope, { ...input, prompt: "Changed request" }, key), {
    code: "IDEMPOTENCY_CONFLICT",
  });
  const leases = await Promise.all([repository.leaseOutbox(), repository.leaseOutbox()]);
  const outbox = leases.flat();
  assert.equal(outbox.length, 2);
  assert.equal(new Set(outbox.map((x) => x.itemId)).size, 2);
  const first = outbox[0];
  const second = outbox[1];
  if (!first || !second) throw new Error("Outbox missing");
  const claims = await Promise.all([
    repository.claim(first.itemId, "fixture-a", 90000),
    repository.claim(first.itemId, "fixture-b", 90000),
  ]);
  assert.equal(claims.filter(Boolean).length, 1);
  const claim = claims.find(Boolean);
  if (!claim) throw new Error("Claim missing");
  await repository.ackOutbox(first.id, first.leaseToken);
  assert.equal(
    await repository.finish(
      { ...claim, executionToken: randomUUID() },
      { errorCode: "FIXTURE_FAILED", unknown: false },
    ),
    false,
  );
  assert.equal(
    await repository.finish(claim, { errorCode: "FIXTURE_FAILED", unknown: false }),
    true,
  );
  assert.equal(
    await repository.finish(claim, { errorCode: "FIXTURE_FAILED", unknown: false }),
    false,
  );
  assert.equal((await repository.wallet(scope)).balance, 18);
  const retry = await repository.retry(scope, jobId, randomUUID(), claim.itemId, true);
  assert.equal(retry.replayed, false);
  assert.equal((await repository.wallet(scope)).balance, 16);
  assert.equal(
    await repository.finish(claim, { errorCode: "LATE_FIXTURE", unknown: false }),
    false,
  );
  const polling = await repository.claim(second.itemId, "fixture-poll", 90000);
  if (!polling) throw new Error("Polling claim missing");
  await repository.deferProvider(
    polling,
    "upstream-fixture",
    "/task/fixture",
    2000,
    false,
    "request-fixture",
  );
  assert.equal(
    (await sql`select phase from provider_executions where item_id=${polling.itemId}`)[0]?.phase,
    "polling",
  );
  await repository.finish(polling, { errorCode: "PROVIDER_OUTCOME_UNKNOWN", unknown: true });
  assert.equal((await repository.wallet(scope)).balance, 16);
  await repository.reconcile(scope, jobId, polling.itemId, "Isolated fixture confirms failure");
  assert.equal((await repository.wallet(scope)).balance, 18);
  const asset = {
    id: randomUUID(),
    objectKey: `${scope.uid}/${scope.organizationId}/${randomUUID()}.png`,
    mimeType: "image/png" as const,
    width: 2,
    height: 2,
    bytes: 12,
    sha256: "a".repeat(64),
  };
  await repository.addReference(scope, asset);
  assert.equal((await repository.asset(scope, asset.id))?.sha256, asset.sha256);
  assert.equal(await repository.asset(stranger, asset.id), null);
  assert.equal((await repository.assetLocations(scope, [asset.id])).length, 1);
  assert.equal((await repository.listAssets(scope, 10)).length, 1);
  const plan = await repository.variation.begin(
    scope,
    { description: "隔离测试设计", referenceAssetIds: [asset.id] },
    randomUUID(),
  );
  await repository.variation.finish(scope, plan.plan.id, [
    { id: randomUUID(), title: "测试方案", prompt: "一个隔离测试方案" },
  ]);
  assert.equal((await repository.variation.get(scope, plan.plan.id))?.status, "ready");
  const readyPlan = await repository.variation.get(scope, plan.plan.id);
  if (!readyPlan) throw new Error("Ready variation plan missing");
  const variationInput = imageGenerationInputSchema.parse({
    ...input,
    count: 1,
    referenceAssetIds: [asset.id],
    variation: { version: 1, planId: readyPlan.id, items: readyPlan.items },
  });
  const variationKey = randomUUID();
  const variationJob = await repository.create(scope, variationInput, variationKey);
  assert.equal((await repository.create(scope, variationInput, variationKey)).id, variationJob.id);
  assert.equal((await repository.wallet(scope)).balance, 16);
  const variationItems =
    await sql`select id from generation_job_items where job_id=${variationJob.id}`;
  assert.equal(variationItems.length, 1);
  const variationOutbox =
    await sql`select count(*)::int as count from generation_outbox where item_id=${variationItems[0]?.id}`;
  assert.equal(variationOutbox[0]?.count, 1);
  const variationClaim = await repository.claim(variationItems[0]?.id, "variation-fixture", 90000);
  if (!variationClaim) throw new Error("Variation claim missing");
  await repository.finish(variationClaim, { errorCode: "FIXTURE_FAILED", unknown: false });
  assert.equal((await repository.wallet(scope)).balance, 18);
  const feed = cloudbaseImageEventFeed(call);
  const cursor = await feed.latest(scope);
  assert.notEqual(cursor, "0");
  const events = await feed.since(scope, "0");
  assert(events.length > 0);
  assert.equal((await feed.since(stranger, "0")).length, 0);
  await feed.close();
  await repository.walletEntries(scope, 10);
  await repository.rechargeOrders(scope, 10);
  await repository.list(scope, 10);
  await repository.latestEdit(scope, asset.id);
  await repository.providerRetryCandidates(scope, jobId);
  await repository.resumeProvider(scope, jobId, claim.itemId);
  await repository.expiredReferences();
  await repository.markReferenceDeleted(asset.id);
  await repository.expireClaims();
  await repository.settleInvalidResponses();
  await repository.pruneEvents();
  await repository.archive(scope, jobId);
  await sql.begin(async (tx) => {
    await tx.unsafe("set local role service_role");
    const [row] =
      await tx`select public.lycobo_image_operation('wallet',${tx.json({ organizationId: scope.organizationId, userId: scope.userId })}) result`;
    assert.equal(row?.result.balance, 18);
  });
  await assert.rejects(
    sql.begin(async (tx) => {
      await tx.unsafe("set local role service_role");
      await tx`select * from organization_wallets`;
    }),
    { code: "42501" },
  );
  for (const role of ["anon", "authenticated"]) {
    await assert.rejects(
      sql.begin(async (tx) => {
        await tx.unsafe(`set local role ${role}`);
        await tx`select public.lycobo_image_operation('wallet',${tx.json({ organizationId: scope.organizationId, userId: scope.userId })})`;
      }),
      { code: "42501" },
    );
  }
  const webhookConfig = await standaloneModels({
    STANDALONE_MODELS: "true",
    STANDALONE_IMAGE_API_KEY: "fixture-only",
    DEEPSEEK_API_KEY: "fixture-only",
    IMAGE_WEBHOOK_ENABLED: "true",
  });
  if (!webhookConfig) throw new Error("Missing webhook config");
  const webhooks = cloudbaseImageRepository(call, webhookConfig);
  const webhookJob = await webhooks.create(scope, { ...input, count: 1 }, randomUUID());
  const [webhookItem] =
    await sql`select id from generation_job_items where job_id=${webhookJob.id}`;
  const webhookClaim = await webhooks.claim(webhookItem?.id, "webhook-fixture", 90000);
  if (!webhookClaim?.configuredProvider?.snapshot.webhook) throw new Error("Missing webhook claim");
  const receipt = {
    source: webhookClaim.configuredProvider.snapshot.webhook.source,
    eventId: "evt_early",
    taskId: "imgtask_early",
    eventType: "image.task.completed" as const,
    taskStatus: "success" as const,
  };
  const balance = (await webhooks.wallet(scope)).balance;
  assert.equal(await webhooks.webhookReceive(receipt), false);
  assert.equal(
    await webhooks.webhookWait(webhookClaim, receipt.taskId, "/v1/images/tasks/imgtask_early"),
    true,
  );
  assert.equal(await webhooks.webhookReceive(receipt), true);
  assert.equal((await webhooks.wallet(scope)).balance, balance);
  assert.equal(
    (await sql`select count(*)::int n from provider_webhook_events where event_id='evt_early'`)[0]
      ?.n,
    1,
  );
  await assert.rejects(webhooks.webhookReceive({ ...receipt, taskStatus: "uncertain" }), {
    message: "IDEMPOTENCY_CONFLICT",
  });
  assert.equal(await webhooks.webhookReceive({ ...receipt, source: "b".repeat(64) }), false);
  assert.equal((await webhooks.getMany(stranger, [webhookJob.id])).length, 0);
  assert.equal((await webhooks.getMany(scope, [webhookJob.id]))[0]?.recovery_due, true);
  await sql`update generation_job_items set started_at=now()-interval '4 hours',lease_expires_at=now()-interval '3 hours' where id=${webhookClaim.itemId}`;
  await sql`update provider_executions set deadline_at=now()-interval '3 hours' where item_id=${webhookClaim.itemId}`;
  await webhooks.expireClaims();
  assert.equal((await webhooks.getMany(scope, [webhookJob.id]))[0]?.status, "running");
  assert.equal((await native.getMany(scope, [webhookJob.id]))[0]?.status, "running");
  assert.equal((await native.getMany(stranger, [webhookJob.id])).length, 0);
  const lateClaim = await webhooks.claim(webhookClaim.itemId, "late-webhook", 90000);
  assert(lateClaim);
  assert.equal(await webhooks.webhookReceive({ ...receipt, eventId: "evt_during_lease" }), false);
  assert.equal(
    await webhooks.webhookWait(lateClaim, receipt.taskId, "/v1/images/tasks/imgtask_early"),
    true,
  );
  const finalClaim = await webhooks.claim(webhookClaim.itemId, "final-webhook", 90000);
  assert(finalClaim);
  await webhooks.finish(finalClaim, { errorCode: "PROVIDER_OUTCOME_UNKNOWN", unknown: true });
  assert.equal((await webhooks.wallet(scope)).balance, balance);
  assert.equal(await webhooks.webhookReceive({ ...receipt, eventId: "evt_late_recovery" }), true);
  const recoveredClaim = await webhooks.claim(webhookClaim.itemId, "recovered-webhook", 90000);
  assert(recoveredClaim);
  await webhooks.finish(recoveredClaim, { errorCode: "PROVIDER_TASK_FAILED", unknown: false });
  const finalBalance = (await webhooks.wallet(scope)).balance;
  assert.equal(finalBalance, balance + 2);
  assert.equal(await webhooks.webhookReceive({ ...receipt, eventId: "evt_after_finished" }), false);
  assert.equal((await webhooks.wallet(scope)).balance, finalBalance);
  await webhooks.retry(scope, webhookJob.id, randomUUID(), webhookClaim.itemId, true);
  const retryBalance = (await webhooks.wallet(scope)).balance;
  assert.equal(await webhooks.webhookReceive({ ...receipt, eventId: "evt_superseded" }), false);
  assert.equal((await webhooks.wallet(scope)).balance, retryBalance);
  await webhooks.pruneWebhooks();
  for (const role of ["anon", "authenticated"]) {
    await assert.rejects(
      sql.begin(async (tx) => {
        await tx.unsafe(`set local role ${role}`);
        await tx`select public.lycobo_provider_webhook('prune','{}'::jsonb)`;
      }),
      { code: "42501" },
    );
  }
  console.log(
    "CloudBase image RPC integration passed: concurrent submit/claim/outbox, wallet atomicity, idempotency, refunds, retries, stale execution, polling, tenant assets and variation plans (local fixtures only)",
  );
} finally {
  await native.close();
  await sql.end();
  await admin.unsafe(`drop database if exists "${dbName}" with (force)`);
  await admin.end();
}
