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

import {
  verifyCloudbaseOptimizer,
  verifyCloudbaseVideos,
  verifyCloudbaseWebhooks,
} from "./verify-cloudbase-media";

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
  // Model CloudBase's default grants in the isolated database.
  await sql`alter default privileges in schema public grant execute on functions to anon, authenticated`;
  await sql`alter default privileges in schema public grant all on tables to anon, authenticated, service_role`;
  // CloudBase provisions this catalog. Plain PostgreSQL in CI needs a local fixture.
  await sql`create schema storage`;
  await sql`create table storage.buckets (
    id text primary key, name text not null, public boolean not null,
    file_size_limit bigint, allowed_mime_types text[]
  )`;
  const migrations = new URL("../../../cloudbase/migrations/", import.meta.url);
  for (const migration of (await readdir(fileURLToPath(migrations.href)))
    .filter(
      (name) =>
        name.endsWith(".sql") &&
        (name === "20261031223300_private_image_storage.sql" || name >= "20261031223500"),
    )
    .sort()) {
    await sql.unsafe(await readFile(fileURLToPath(new URL(migration, migrations).href), "utf8"));
  }
  const [videoBucket] = await sql`select public, file_size_limit::integer as max_bytes,
    allowed_mime_types from storage.buckets where id = 'lycobo-images'`;
  assert.equal(videoBucket?.public, false);
  assert.equal(videoBucket?.max_bytes, 128 * 1024 * 1024);
  assert.deepEqual(videoBucket?.allowed_mime_types, [
    "image/png",
    "image/webp",
    "video/mp4",
    "image/jpeg",
  ]);
  const [videoGrants] = await sql`select has_function_privilege(
    'service_role', 'public.lycobo_video_operation(text,jsonb)', 'EXECUTE'
  ) as runtime_execute`;
  assert.equal(videoGrants?.runtime_execute, true);
  for (const role of ["anon", "authenticated", "service_role"]) {
    const [grant] = await sql`select has_table_privilege(${role}, 'public.generation_video_outbox',
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as direct_access`;
    assert.equal(grant?.direct_access, false, `${role} must access video data through the API`);
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
    assert(
      [
        "lycobo_image_operation",
        "lycobo_provider_webhook",
        "lycobo_video_operation",
        "lycobo_prompt_optimization",
      ].includes(operation),
    );
    const args = z
      .object({ p_operation: z.string(), p_args: z.record(z.string(), z.unknown()) })
      .parse(parameters);
    try {
      if (operation === "lycobo_prompt_optimization") {
        const [row] =
          await sql`select public.lycobo_prompt_optimization(${args.p_operation},${sql.json(z.json().parse(args.p_args))}) result`;
        return row?.result;
      }
      if (operation === "lycobo_video_operation") {
        const [row] =
          await sql`select public.lycobo_video_operation(${args.p_operation},${sql.json(z.json().parse(JSON.parse(JSON.stringify(args.p_args))))}) result`;
        return row?.result;
      }
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
  await verifyCloudbaseOptimizer(sql, native, repository, stranger);
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
  // Asset library over the RPC: tool and model filters, favorite flags and personal favorites.
  const output = randomUUID();
  await sql`insert into media_assets (id,organization_id,user_id,kind,media_type,object_key,mime_type,width,height,bytes,sha256)
    values (${output},${scope.organizationId},${scope.userId},'output','image',${`fixtures/${output}.png`},'image/png',2,2,12,${"b".repeat(64)})`;
  await sql`update generation_job_items set status='succeeded',output_asset_id=${output} where id=${variationItems[0]?.id}`;
  await sql`update generation_jobs set model='gpt-image-2-4K' where id=${variationJob.id}`;
  const library = (filters: Parameters<typeof repository.listAssets>[5]) =>
    repository.listAssets(scope, 10, undefined, undefined, undefined, filters);
  const [listedOutput] = await library({ tool: "variation", model: "gpt-image-2" });
  assert.equal(listedOutput?.id, output);
  assert.equal(listedOutput?.tool, "variation");
  assert.equal(listedOutput?.model, "gpt-image-2");
  assert.equal((await library({ tool: "textile" })).length, 0);
  assert.equal(
    (await repository.listAssets(scope, 10, undefined, "reference")).find(
      (row) => row.id === asset.id,
    )?.tool,
    null,
  );
  assert.equal(await repository.setAssetFavorite(scope, output, true), true);
  assert.equal(await repository.setAssetFavorite(scope, output, true), true);
  assert.equal(await repository.setAssetFavorite(stranger, output, true), null);
  assert.deepEqual(await repository.favoriteAssetIds(scope), [output]);
  assert.deepEqual(await repository.favoriteAssetIds(stranger), []);
  const [favorite] = await library({ favorite: true });
  assert.equal(favorite?.id, output);
  assert.equal(favorite?.favorite, true);
  assert.equal(await repository.setAssetFavorite(scope, output, false), false);
  assert.equal((await library({ favorite: true })).length, 0);
  await sql`insert into media_assets (organization_id,user_id,kind,media_type,object_key,mime_type,width,height,bytes,sha256)
    select ${scope.organizationId},${scope.userId},'output','image','fixtures/limit-'||${randomUUID()}||'-'||n,'image/png',2,2,12,${"b".repeat(64)}
    from generate_series(1,1000) n`;
  await sql`insert into image_asset_favorites (organization_id,user_id,asset_id)
    select organization_id,user_id,id from media_assets
    where organization_id=${scope.organizationId} and object_key like 'fixtures/limit-%'`;
  await assert.rejects(repository.setAssetFavorite(scope, output, true), {
    code: "STATE_CONFLICT",
  });
  assert.equal((await repository.favoriteAssetIds(scope)).length, 1000);
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
  await verifyCloudbaseWebhooks(call, sql, native, scope, stranger, input);
  await verifyCloudbaseVideos(call, sql, native, repository);
  console.log(
    "CloudBase image RPC integration passed: concurrent submit/claim/outbox, wallet atomicity, idempotency, refunds, retries, stale execution, polling, tenant assets and variation plans (local fixtures only)",
  );
} finally {
  await native.close();
  await sql.end();
  await admin.unsafe(`drop database if exists "${dbName}" with (force)`);
  await admin.end();
}
