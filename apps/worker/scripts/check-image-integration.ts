import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  apiErrorSchema,
  imageAssetsResponseSchema,
  imageGenerationInputSchema,
  imageJobSchema,
  rechargeOrdersSchema,
  unwrapApiData,
  walletBalanceSchema,
  walletEntriesSchema,
} from "@lycoboai/contracts";
import { openImageRepository } from "@lycoboai/db";
import { supportedResolutions, validateModelInput } from "@lycoboai/generation";
import { createImageQueue, imageQueueJobSchema, redisConnection } from "@lycoboai/queue";
import { imageStore } from "@lycoboai/storage";
import { QueueEvents, Worker } from "bullmq";
import postgres from "postgres";
import { z } from "zod";
import { createApp } from "../../api/src/app";
import { processImageItem } from "../src/image-processor";
import { verifyGenerationMigration } from "./verify-generation-migration";
import { verifyLocalEdits } from "./verify-local-edits";
import { verifyWallet } from "./verify-wallet";

if (process.env.ALLOW_LOCAL_INTEGRATION !== "true")
  throw new Error("Explicit isolated test opt-in required");
function local(value: string | undefined, protocols: string[]) {
  if (!value) throw new Error("Explicit isolated URLs required");
  const u = new URL(value);
  if (!protocols.includes(u.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname))
    throw new Error("Only loopback test services allowed");
  return value;
}
const baseDatabaseUrl = local(process.env.DATABASE_URL, ["postgres:", "postgresql:"]);
const testDatabaseName = `image_test_${crypto.randomUUID().replaceAll("-", "")}`;
const admin = postgres(baseDatabaseUrl, { max: 1 });
const isolatedUrl = new URL(baseDatabaseUrl);
isolatedUrl.pathname = `/${testDatabaseName}`;
const databaseUrl = isolatedUrl.href;
await admin.unsafe(`create database "${testDatabaseName}"`);
try {
  await verifyGenerationMigration(databaseUrl);
} catch (error) {
  await admin.unsafe(`drop database if exists "${testDatabaseName}"`);
  await admin.end({ timeout: 5 });
  throw error;
}
const redisUrl = local(process.env.REDIS_URL, ["redis:", "rediss:"]);
const runId = crypto.randomUUID(),
  queueName = `lycobo-image-test-${runId}`;
const sql = postgres(databaseUrl, { max: 3 }),
  repository = openImageRepository(databaseUrl);
const directory = await mkdtemp(path.join(tmpdir(), "lycobo-image-integration-"));
const store = imageStore(directory);
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADklEQVQImWP4DwYMEAoAU7oL9W/sIDEAAAAASUVORK5CYII=",
  "base64",
);
const organizations: string[] = [],
  users: string[] = [];
let calls = 0,
  mixed = 0;
const server = createServer(async (req, res) => {
  calls++;
  let raw = "";
  for await (const bytes of req) raw += bytes.toString();
  const body = z
    .object({
      model: imageGenerationInputSchema.shape.model,
      prompt: imageGenerationInputSchema.shape.prompt,
    })
    .parse(JSON.parse(raw));
  if (body.prompt === "ambiguous") {
    res.writeHead(503);
    res.end("sensitive provider data");
    return;
  }
  if (body.prompt === "mixed" && mixed++ === 1) {
    res.writeHead(400);
    res.end("sensitive provider data");
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json", "x-request-id": `fixture-${calls}` });
  res.end(JSON.stringify({ data: [{ b64_json: png.toString("base64") }] }));
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
if (!address || typeof address === "string") throw new Error("Fixture startup failed");
const queue = createImageQueue(redisUrl, queueName),
  events = new QueueEvents(queueName, { connection: redisConnection(redisUrl) });
const worker = new Worker(
  queueName,
  async (job) =>
    processImageItem(imageQueueJobSchema.parse(job.data).itemId, {
      repository,
      store,
      workerId: "integration-worker",
      provider: {
        key: "fixture-key",
        baseUrl: `http://127.0.0.1:${address.port}`,
        timeoutMs: 1500,
        allowHttpForTests: true,
      },
      overrides: {},
      editsEnabled: false,
    }),
  { connection: redisConnection(redisUrl), concurrency: 3, maxStalledCount: 0 },
);
const app = createApp(() => {}, {
  repository,
  store,
  enabled: true,
  unitCredits: 1,
  validate: (input) => validateModelInput(input),
  resolutions: supportedResolutions,
});
const input = (prompt: string, count = 1) =>
  imageGenerationInputSchema.parse({ model: "gpt-image-2", prompt, count });
async function dispatch() {
  const outbox = await repository.leaseOutbox();
  for (const event of outbox) {
    const job = await queue.add("generate-image", { itemId: event.itemId }, { jobId: event.id });
    await repository.ackOutbox(event.id, event.leaseToken);
    await job.waitUntilFinished(events, 10000);
  }
}
try {
  await events.waitUntilReady();
  await worker.waitUntilReady();
  const first = await repository.provision(`test-${runId}`, "test-team", 400);
  const renewed = await repository.provision(`test-${runId}`, "test-team", 999, true);
  assert.equal(renewed.organizationId, first.organizationId);
  assert.equal((await repository.authenticate(renewed.token))?.userId, first.userId);
  organizations.push(first.organizationId);
  users.push(first.userId);
  const second = await repository.provision(`other-${runId}`, "other-team", 200);
  organizations.push(second.organizationId);
  users.push(second.userId);
  const headers = { Authorization: `Bearer ${first.token}`, "Content-Type": "application/json" };
  assert.equal((await app.request("/api/v1/image-models")).status, 401);
  assert.equal(
    (await app.request("/api/v1/image-models", { headers: { Authorization: "Bearer forged" } }))
      .status,
    401,
  );
  const models = await app.request("/api/v1/image-models", { headers });
  assert.equal(models.status, 200);
  const forged = await app.request("/api/v1/image-tasks", {
    method: "POST",
    headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({ ...input("test"), userId: second.userId }),
  });
  assert.equal(forged.status, 400);
  assert.equal(
    (
      await app.request("/api/v1/image-tasks", {
        method: "POST",
        headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ ...input("test"), model: "gpt-image-2", resolution: "8K" }),
      })
    ).status,
    400,
  );
  const upload = await app.request("/api/v1/image-assets", {
    method: "POST",
    headers: { Authorization: headers.Authorization, "Content-Type": "image/png" },
    body: new Uint8Array(png),
  });
  assert.equal(upload.status, 201);
  const uploaded = z.object({ id: z.uuid() }).parse(unwrapApiData(await upload.json()));
  assert.equal(
    (
      await app.request(`/api/v1/image-assets/${uploaded.id}/content`, {
        headers: { Authorization: `Bearer ${second.token}` },
      })
    ).status,
    404,
  );
  const before =
    await sql`select balance as available_credits from organization_wallets where organization_id=${second.organizationId}`;
  await assert.rejects(
    repository.create(
      second,
      { ...input("stolen"), referenceAssetIds: [uploaded.id] },
      crypto.randomUUID(),
      1,
    ),
    /REFERENCE_NOT_FOUND/,
  );
  assert.equal(
    (
      await sql`select balance as available_credits from organization_wallets where organization_id=${second.organizationId}`
    )[0]?.available_credits,
    before[0]?.available_credits,
  );
  const key = crypto.randomUUID();
  const submissions = await Promise.all(
    Array.from({ length: 6 }, () => repository.create(first, input("mixed", 2), key, 1)),
  );
  assert.equal(new Set(submissions.map((r) => r.id)).size, 1);
  assert.equal(submissions.filter((r) => !r.replayed).length, 1);
  const taskId = submissions[0]?.id;
  if (!taskId) throw new Error("Missing task");
  await assert.rejects(repository.create(first, input("changed"), key, 1), /IDEMPOTENCY_CONFLICT/);
  assert.equal(await repository.get(second, taskId), null);
  assert.equal(
    (
      await app.request(`/api/v1/image-tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${second.token}` },
      })
    ).status,
    404,
  );
  await dispatch();
  const [job] = await sql`select status from generation_jobs where id=${taskId}`;
  assert.equal(job?.status, "partially_failed");
  const items =
    await sql`select * from generation_job_items where job_id=${taskId} order by position`;
  assert.equal(items.filter((i) => i.status === "succeeded").length, 1);
  assert.equal(items.filter((i) => i.status === "failed").length, 1);
  assert.equal(items[0]?.worker_id, "integration-worker");
  assert.ok(items[0]?.started_at);
  assert.ok(items[0]?.completed_at);
  const success = items.find((i) => i.status === "succeeded");
  if (!success) throw new Error("Missing output");
  const asset = await repository.asset(first, success.output_asset_id);
  assert.ok(asset);
  assert.equal(asset.width, 2);
  assert.equal(asset.height, 2);
  assert.ok((await store.read(asset)).length);
  const listedOutput = (await repository.listAssets(first, 30)).find(
    (row) => row.id === success.output_asset_id,
  );
  const sourceTask = await repository.get(first, taskId);
  assert.ok(sourceTask?.public_id);
  assert.equal(listedOutput?.task_public_id, sourceTask.public_id);
  assert.notEqual(listedOutput?.public_id, listedOutput?.task_public_id);
  const balance =
    await sql`select balance as available_credits from organization_wallets where organization_id=${first.organizationId}`;
  assert.equal(balance[0]?.available_credits, 380);
  const repeat = await queue.add("generate-image", { itemId: String(success.id) });
  await repeat.waitUntilFinished(events, 10000);
  assert.equal(calls, 2);
  const persisted = openImageRepository(databaseUrl);
  try {
    assert.equal((await persisted.get(first, taskId))?.status, "partially_failed");
  } finally {
    await persisted.close();
  }
  const unknown = await repository.create(first, input("ambiguous"), crypto.randomUUID(), 1);
  await dispatch();
  assert.equal((await repository.get(first, unknown.id))?.status, "needs_reconciliation");
  const [uncertain] = await sql`select id from generation_job_items where job_id=${unknown.id}`;
  assert.ok(uncertain);
  assert.equal(await repository.claim(uncertain.id, "another-worker", 1000), null);
  const held = (
    await sql`select balance as available_credits from organization_wallets where organization_id=${first.organizationId}`
  )[0]?.available_credits;
  assert.equal(held, 360);
  await repository.reconcile(
    first,
    unknown.id,
    uncertain.id,
    "fixture provider confirms no output and no charge",
  );
  await assert.rejects(
    repository.reconcile(
      first,
      unknown.id,
      uncertain.id,
      "repeat reconciliation must not refund again",
    ),
    /STATE_CONFLICT/,
  );
  assert.equal(
    (
      await sql`select balance as available_credits from organization_wallets where organization_id=${first.organizationId}`
    )[0]?.available_credits,
    380,
  );
  const apiKey = crypto.randomUUID();
  const apiSubmission = () => ({
    method: "POST",
    headers: { ...headers, "Idempotency-Key": apiKey },
    body: JSON.stringify(input("api-success")),
  });
  const accepted = await app.request("/api/v1/image-tasks", apiSubmission());
  assert.equal(accepted.status, 202);
  const acceptedJob = z
    .object({ id: z.uuid(), replayed: z.boolean() })
    .parse(unwrapApiData(await accepted.json()));
  await dispatch();
  const response = await app.request(`/api/v1/image-tasks/${acceptedJob.id}`, { headers });
  const record = z
    .object({
      organization_id: z.uuid(),
      user_id: z.uuid(),
      status: z.string(),
      created_at: z.string(),
    })
    .parse(unwrapApiData(await response.json()));
  assert.equal(record.status, "succeeded");
  assert.equal(record.organization_id, first.organizationId);
  assert.equal(record.user_id, first.userId);
  const detailed = imageJobSchema.parse(
    JSON.parse(JSON.stringify(await repository.get(first, acceptedJob.id))),
  );
  assert.match(detailed.public_id ?? "", /^W[0-9A-Z]{8}$/);
  const output = detailed.items[0];
  assert.match(output?.output_public_id ?? "", /^P[0-9A-Z]{8}$/);
  const assetResponse = await app.request("/api/v1/image-assets?limit=100", { headers });
  const assetList = imageAssetsResponseSchema.parse(unwrapApiData(await assetResponse.json())).data;
  assert.equal(
    assetList.find((asset) => asset.id === output?.output_asset_id)?.public_id,
    output?.output_public_id,
  );
  assert.equal(new Set(assetList.map((asset) => asset.public_id)).size, assetList.length);
  // Kind filtering must happen before pagination, and retain organization scope.
  const readAssets = async (query: string, authorization = headers.Authorization) => {
    const response = await app.request(`/api/v1/image-assets?${query}`, {
      headers: { Authorization: authorization },
    });
    assert.equal(response.status, 200);
    return imageAssetsResponseSchema.parse(unwrapApiData(await response.json())).data;
  };
  const outputs = await readAssets("limit=100&kind=output");
  assert.ok(outputs.length > 0);
  assert.ok(outputs.every((asset) => asset.kind === "output"));
  assert.ok(outputs.every((asset) => asset.type === "image"));

  assert.ok(!outputs.some((asset) => asset.id === uploaded.id));
  const references = await readAssets("limit=100&kind=reference");
  assert.ok(references.some((asset) => asset.id === uploaded.id));
  assert.ok(references.every((asset) => asset.kind === "reference" && asset.type === "image"));
  assert.deepEqual(await readAssets("limit=100&kind=output&type=image"), outputs);
  assert.deepEqual(await readAssets("limit=100&kind=output&type=video"), []);
  assert.deepEqual(await readAssets("limit=100&kind=output&type=audio"), []);
  const persistedAssetId = output?.output_asset_id;
  assert.ok(persistedAssetId);
  const [persistedType] =
    await sql`select media_type from media_assets where id=${persistedAssetId}`;
  assert.equal(persistedType?.media_type, "image");
  await assert.rejects(
    sql`update media_assets set media_type='invalid' where id=${persistedAssetId}`,
    (error: unknown) =>
      error instanceof Error && error.message.includes("media_assets_media_type_check"),
  );
  // Old API/Worker releases must still read and insert through the legacy name.
  const relations = await sql`select relname,relkind from pg_class
    where oid in ('public.media_assets'::regclass,'public.image_assets'::regclass)`;
  assert.equal(relations.find((row) => row.relname === "media_assets")?.relkind, "r");
  assert.equal(relations.find((row) => row.relname === "image_assets")?.relkind, "v");
  await sql.begin(async (tx) => {
    const [legacyRead] = await tx`select id,public_id,media_type from image_assets
      where id=${persistedAssetId} and organization_id=${first.organizationId}`;
    assert.equal(legacyRead?.public_id, output?.output_public_id);
    const [legacyWrite] = await tx`insert into image_assets
      (organization_id,user_id,kind,object_key,mime_type,width,height,bytes,sha256)
      select organization_id,user_id,'reference',${`compat/${crypto.randomUUID()}`},
        mime_type,width,height,bytes,sha256 from media_assets where id=${persistedAssetId}
      returning id,public_id,display_number,media_type`;
    assert.ok(legacyWrite?.id);
    assert.match(legacyWrite.public_id, /^P[0-9A-Z]{8}$/);
    assert.ok(legacyWrite.display_number);
    assert.equal(legacyWrite.media_type, "image");
    const [stored] = await tx`select public_id from media_assets where id=${legacyWrite.id}`;
    assert.equal(stored?.public_id, legacyWrite.public_id);
    await tx`delete from image_assets where id=${legacyWrite.id}`;
    const [removed] =
      await tx`select count(*)::int as count from media_assets where id=${legacyWrite.id}`;
    assert.equal(removed?.count, 0);
  });
  const firstOutputPage = await readAssets("limit=1&kind=output");
  assert.deepEqual(firstOutputPage, outputs.slice(0, 1));
  const nextOutputPage = await readAssets(`limit=1&kind=output&before=${outputs[0]?.id}`);
  assert.deepEqual(nextOutputPage, outputs.slice(1, 2));
  assert.deepEqual(await readAssets("limit=100&kind=output", `Bearer ${second.token}`), []);
  assert.equal((await app.request("/api/v1/image-assets?kind=unknown", { headers })).status, 400);
  assert.equal((await app.request("/api/v1/image-assets?kind=output")).status, 401);
  assert.equal((await app.request("/api/v1/image-assets?type=unknown", { headers })).status, 400);

  const reconnected = openImageRepository(databaseUrl);
  try {
    const reread = imageJobSchema.parse(
      JSON.parse(JSON.stringify(await reconnected.get(first, acceptedJob.id))),
    );
    assert.equal(reread.public_id, detailed.public_id);
    assert.equal(reread.items[0]?.output_public_id, output?.output_public_id);
    assert.equal(await reconnected.get(second, acceptedJob.id), null);
  } finally {
    await reconnected.close();
  }
  const sequenceBounds =
    await sql`select sequencename,min_value::text,max_value::text,cycle from pg_sequences where schemaname='public' and sequencename in ('media_assets_display_number_seq','generation_jobs_display_number_seq')`;
  assert.equal(sequenceBounds.length, 2);
  for (const sequence of sequenceBounds) {
    assert.equal(sequence.cycle, false);
    assert.equal(sequence.max_value, "9223372036854775807");
  }

  assert.equal((await app.request("/api/v1/image-tasks", apiSubmission())).status, 200);
  const conflict = await app.request("/api/v1/image-tasks", {
    ...apiSubmission(),
    body: JSON.stringify(input("different")),
  });
  assert.equal(conflict.status, 409);
  assert.ok(apiErrorSchema.parse(await conflict.json()));
  const crashed = await repository.create(first, input("never-submit"), crypto.randomUUID(), 1);
  const [crashItem] = await sql`select id from generation_job_items where job_id=${crashed.id}`;
  assert.ok(crashItem);
  const claims = await Promise.all([
    repository.claim(crashItem.id, "worker-a", 1000),
    repository.claim(crashItem.id, "worker-b", 1000),
  ]);
  assert.equal(claims.filter(Boolean).length, 1);
  await sql`update generation_job_items set lease_expires_at=now()-interval '1 second' where id=${crashItem.id}`;
  await repository.expireClaims();
  assert.equal((await repository.get(first, crashed.id))?.status, "needs_reconciliation");
  assert.equal(await repository.claim(crashItem.id, "worker-c", 1000), null);
  assert.equal(calls, 4);
  const browserApp = createApp(() => {}, {
    repository,
    store,
    enabled: true,
    editsEnabled: true,
    unitCredits: 1,
    validate: (value) => validateModelInput(value, {}, true),
    resolutions: supportedResolutions,
    session: { token: first.token, origins: ["http://localhost:5173"] },
  });
  assert.equal(
    (
      await browserApp.request("/api/v1/image-session", {
        method: "POST",
        headers: { Origin: "https://attacker.example" },
      })
    ).status,
    401,
  );
  const login = await browserApp.request("/api/v1/image-session", {
    method: "POST",
    headers: { Origin: "http://localhost:5173" },
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
  assert.match(login.headers.get("set-cookie") ?? "", /HttpOnly/i);
  assert.match(login.headers.get("set-cookie") ?? "", /SameSite=Strict/i);
  const cookieHeaders = {
    Cookie: cookie,
    Origin: "http://localhost:5173",
    "Content-Type": "application/json",
  };
  assert.equal(
    (
      await browserApp.request("/api/v1/image-tasks", {
        method: "POST",
        headers: { Cookie: cookie, Origin: "https://attacker.example" },
        body: "{}",
      })
    ).status,
    401,
  );
  for (const model of [
    "gpt-image-2",
    "gpt-image-2-4K",
    "gpt-image-2.5",
    "gpt-image-2.5-flare",
    "gpt-image-2.5-sunburst",
  ] as const) {
    const submitted = await browserApp.request("/api/v1/image-tasks", {
      method: "POST",
      headers: { ...cookieHeaders, "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ ...input("browser-flow"), model }),
    });
    assert.equal(submitted.status, 202);
    const task = z.object({ id: z.uuid() }).parse(unwrapApiData(await submitted.json()));
    await dispatch();
    assert.equal((await repository.get(first, task.id))?.status, "succeeded");
  }
  const library = await browserApp.request("/api/v1/image-assets", { headers: { Cookie: cookie } });
  const saved = z
    .object({ data: z.array(z.object({ id: z.uuid(), kind: z.string() })) })
    .parse(unwrapApiData(await library.json()));
  assert.equal(saved.data.filter((asset) => asset.kind === "output").length, 7);
  assert.equal((await repository.listAssets(second, 30)).length, 0);
  const thumbnail = await browserApp.request(
    `/api/v1/image-assets/${asset.id}/content?thumbnail=1`,
    { headers: { Cookie: cookie } },
  );
  assert.equal(thumbnail.status, 200);
  assert.equal(thumbnail.headers.get("content-type"), "image/png");
  const retryKey = crypto.randomUUID();
  assert.equal(
    (
      await app.request(`/api/v1/image-tasks/${taskId}/retry`, {
        method: "POST",
        headers: {
          ...headers,
          Authorization: `Bearer ${second.token}`,
          "Idempotency-Key": retryKey,
        },
      })
    ).status,
    404,
  );
  const retryResponses = await Promise.all(
    Array.from({ length: 4 }, () =>
      app.request(`/api/v1/image-tasks/${taskId}/retry`, {
        method: "POST",
        headers: { ...headers, "Idempotency-Key": retryKey },
      }),
    ),
  );
  assert.equal(retryResponses.filter((response) => response.status === 202).length, 1);
  assert.equal(retryResponses.filter((response) => response.status === 200).length, 3);
  const beforeRetry = await repository.get(first, taskId);
  assert.equal(beforeRetry?.items.length, 2);
  assert.equal(
    beforeRetry?.items.find((entry: { id: string }) => entry.id === success.id)?.output_asset_id,
    asset.id,
  );
  await dispatch();
  const afterRetry = await repository.get(first, taskId);
  assert.equal(afterRetry?.status, "succeeded");
  assert.equal(afterRetry?.items.length, 2);
  assert.equal(
    afterRetry?.items.filter((entry: { status: string }) => entry.status === "succeeded").length,
    2,
  );
  assert.equal(
    (await sql`select count(*)::int as count from generation_job_items where job_id=${taskId}`)[0]
      ?.count,
    3,
  );
  // Retry the already-reserved idempotency key even when the available balance has become zero.
  while ((await repository.wallet(first)).balance >= 20) {
    const count = Math.min(4, Math.floor((await repository.wallet(first)).balance / 20));
    await repository.create(first, input("exhaust-fixture", count), crypto.randomUUID());
  }
  assert.equal((await repository.create(first, input("mixed", 2), key, 1)).replayed, true);
  await assert.rejects(
    repository.create(first, input("no-credit"), crypto.randomUUID(), 1),
    /INSUFFICIENT_CREDITS/,
  );
  walletBalanceSchema.parse(
    unwrapApiData(await (await app.request("/api/v1/wallet", { headers })).json()),
  );
  walletEntriesSchema.parse(
    unwrapApiData(await (await app.request("/api/v1/wallet/entries", { headers })).json()),
  );
  rechargeOrdersSchema.parse(
    unwrapApiData(await (await app.request("/api/v1/wallet/recharges", { headers })).json()),
  );
  assert.equal((await app.request("/api/v1/wallet")).status, 401);
  assert.equal(
    (await app.request("/api/v1/wallet/entries?before=9999999999999999999", { headers })).status,
    400,
  );
  assert.equal(
    (
      await app.request("/api/v1/wallet/recharges", {
        method: "POST",
        headers,
        body: JSON.stringify({ credits: 10000 }),
      })
    ).status,
    404,
  );
  await verifyWallet(repository, sql);
  await verifyLocalEdits(repository, sql, async (path, init) => app.request(path, init));
  await sql`update generation_api_keys set revoked_at=now() where id=${first.keyId}`;
  assert.equal((await app.request("/api/v1/image-models", { headers })).status, 401);
  console.info(
    "Image API auth/isolation, durable outbox, real Redis Worker, persisted files/metadata, idempotency, credits, partial failure and crash reconciliation passed (fixture only)",
  );
} finally {
  await worker.close();
  await events.close();
  await queue.obliterate({ force: true });
  await queue.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await repository.close();
  await sql.end({ timeout: 5 });
  await admin.unsafe(`drop database if exists "${testDatabaseName}"`);
  await admin.end({ timeout: 5 });
  await rm(directory, { recursive: true, force: true });
}
