import assert from "node:assert/strict";
import {
  imageGenerationInputSchema,
  imageJobSchema,
  imageSubmissionResponseSchema,
  imageUnitCredits,
  textileViews,
  unwrapApiData,
} from "@lycoboai/contracts";
import type { ImageRepository } from "@lycoboai/db";
import { supportedResolutions, validateModelInput } from "@lycoboai/generation";
import type { ImageStore } from "@lycoboai/storage";
import type postgres from "postgres";
import { createApp } from "../../api/src/app";
import { processImageItem } from "../src/image-processor";

/** Disposable local database and image store only; never calls a paid provider. */
export async function verifyTextileGeneration(
  repository: ImageRepository,
  sql: postgres.Sql,
  store: ImageStore,
  png: Uint8Array,
) {
  const owner = await repository.provision(`textile-${crypto.randomUUID()}`, "textile-test", 1000);
  const other = await repository.provision(
    `textile-other-${crypto.randomUUID()}`,
    "textile-other",
    40,
  );
  const references: string[] = [];
  for (let index = 0; index < 6; index++) {
    const asset = await store.put(owner, png, crypto.randomUUID());
    await repository.addReference(owner, asset);
    references.push(asset.id);
  }
  const app = createApp(undefined, {
    repository,
    store,
    enabled: true,
    editsEnabled: true,
    unitCredits: 20,
    validate: (input) => validateModelInput(input, {}, true),
    resolutions: supportedResolutions,
  });
  const body = imageGenerationInputSchema.parse({
    model: "gpt-image-2",
    prompt: "untrusted-client",
    resolution: "2K",
    count: 10,
    referenceAssetIds: references,
    textileSet: { version: 4, views: textileViews.map((view) => view.id) },
  });
  const headers = {
    Authorization: `Bearer ${owner.token}`,
    "Content-Type": "application/json",
    "Idempotency-Key": crypto.randomUUID(),
  };
  const submit = () =>
    app.request("/api/v1/image-tasks", { method: "POST", headers, body: JSON.stringify(body) });
  const first = await submit();
  assert.equal(first.status, 202);
  const submitted = imageSubmissionResponseSchema.parse(unwrapApiData(await first.json()));
  assert.equal((await submit()).status, 200);
  assert.equal((await repository.wallet(owner)).balance, 1000 - 10 * imageUnitCredits);
  const job = imageJobSchema.parse(
    JSON.parse(JSON.stringify(await repository.get(owner, submitted.id))),
  );
  assert.equal(job.items.length, 10);
  assert.equal(job.model, "gpt-image-2");
  assert.equal(job.input?.model, "gpt-image-2-4K");
  assert.equal(job.resolution, "2K");
  assert.equal(job.input?.textileSet?.views.length, 10);
  assert.equal((await repository.list(owner, 20, undefined, "textile")).length, 1);
  assert.equal((await repository.list(owner, 20, undefined, "create")).length, 0);
  assert.equal((await repository.list(other, 20, undefined, "textile")).length, 0);
  const forbidden = await app.request("/api/v1/image-tasks", {
    method: "POST",
    headers: { ...headers, Authorization: `Bearer ${other.token}` },
    body: JSON.stringify(body),
  });
  assert.equal(forbidden.status, 400);
  assert.equal((await repository.wallet(other)).balance, 40);
  await verifyTextileProviderPrompts(png, repository, store, job, owner, sql);
  // A card retries one unresolved item while another item remains queued.
  await verifyTextileTargetedRetry(repository, owner, app, sql, other, store, png, references);
}

async function verifyTextileProviderPrompts(
  png: Uint8Array,
  repository: ImageRepository,
  store: ImageStore,
  job: ReturnType<typeof imageJobSchema.parse>,
  owner: Awaited<ReturnType<ImageRepository["provision"]>>,
  sql: postgres.Sql,
) {
  const prompts: string[] = [];
  const request: typeof fetch = async (_url, init) => {
    assert(init?.body instanceof FormData);
    const prompt = String(init.body.get("prompt"));
    prompts.push(prompt);
    assert.equal(init.body.get("n"), "1");
    assert.equal(init.body.get("size"), "2048x2048");
    assert.equal(init.body.getAll("image[]").length, 6);
    assert.equal(init.body.get("model"), "gpt-image-2-4K");
    if (prompt.includes("拍摄要求：枕头特写")) return new Response("{}", { status: 400 });
    return Response.json({ data: [{ b64_json: Buffer.from(png).toString("base64") }] });
  };
  const deps = {
    repository,
    store,
    workerId: "textile-fixture",
    provider: {
      key: "fixture",
      baseUrl: "http://127.0.0.1",
      allowHttpForTests: true,
      timeoutMs: 1000,
    },
    overrides: {},
    editsEnabled: true,
    request,
  };
  for (const item of job.items) {
    await processImageItem(item.id, deps);
    await processImageItem(item.id, deps);
  }
  assert.equal(prompts.length, 10);
  assert.equal(new Set(prompts).size, 10);
  for (const view of textileViews)
    assert(prompts.some((prompt) => prompt.includes(`拍摄要求：${view.name}`)));
  const complete = imageJobSchema.parse(
    JSON.parse(JSON.stringify(await repository.get(owner, job.id))),
  );
  assert.equal(complete.status, "partially_failed");
  assert.equal(complete.items.filter((item) => item.status === "succeeded").length, 9);
  assert.equal((await repository.wallet(owner)).balance, 1000 - 9 * imageUnitCredits);
  const retry = await repository.retry(owner, job.id, crypto.randomUUID());
  assert.equal(retry.id, job.id);
  assert.equal((await repository.wallet(owner)).balance, 1000 - 10 * imageUnitCredits);
  const retried = imageJobSchema.parse(
    JSON.parse(JSON.stringify(await repository.get(owner, job.id))),
  );
  assert.deepEqual(
    retried.items.filter((item) => item.status === "queued").map((item) => item.position),
    [3],
  );
  assert.equal(
    (
      await sql`select count(*)::int as n from generation_outbox where item_id in (select id from generation_job_items where job_id=${job.id})`
    )[0]?.n,
    11,
  );
}

async function verifyTextileTargetedRetry(
  repository: ImageRepository,
  owner: Awaited<ReturnType<ImageRepository["provision"]>>,
  app: ReturnType<typeof createApp>,
  sql: postgres.Sql,
  other: Awaited<ReturnType<ImageRepository["provision"]>>,
  store: ImageStore,
  png: Uint8Array<ArrayBufferLike>,
  references: string[],
) {
  const batch = await repository.create(
    owner,
    imageGenerationInputSchema.parse({
      model: "gpt-image-2",
      prompt: "targeted-retry-fixture",
      count: 3,
    }),
    crypto.randomUUID(),
  );
  const batchJob = imageJobSchema.parse(
    JSON.parse(JSON.stringify(await repository.get(owner, batch.id))),
  );
  const firstItem = batchJob.items[0],
    secondItem = batchJob.items[1],
    thirdItem = batchJob.items[2];
  assert(firstItem && secondItem && thirdItem);
  const unresolved = await repository.claim(firstItem.id, "targeted-fixture", 60000);
  const rejected = await repository.claim(secondItem.id, "targeted-fixture", 60000);
  assert(unresolved && rejected);
  await repository.finish(unresolved, { errorCode: "PROVIDER_TIMEOUT", unknown: true });
  await repository.finish(rejected, { errorCode: "PROVIDER_HTTP_400", unknown: false });
  const beforeTargeted = (await repository.wallet(owner)).balance;
  const targetedKey = crypto.randomUUID();
  const targetHeaders = {
    Authorization: `Bearer ${owner.token}`,
    "Content-Type": "application/json",
    "Idempotency-Key": targetedKey,
  };
  const targetRequest = (itemId: string) =>
    app.request(`/api/v1/image-tasks/${batch.id}/retry`, {
      method: "POST",
      headers: targetHeaders,
      body: JSON.stringify({ itemId }),
    });
  assert.equal((await targetRequest(firstItem.id)).status, 202);
  assert.equal((await targetRequest(firstItem.id)).status, 200);
  assert.equal((await targetRequest(secondItem.id)).status, 409);
  const afterTargeted = imageJobSchema.parse(
    JSON.parse(JSON.stringify(await repository.get(owner, batch.id))),
  );
  assert.equal(afterTargeted.items.find((item) => item.position === 1)?.id, secondItem.id);
  assert.equal(afterTargeted.items.find((item) => item.position === 1)?.status, "failed");
  assert.equal(afterTargeted.items.find((item) => item.position === 2)?.id, thirdItem.id);
  assert.equal(afterTargeted.items.find((item) => item.position === 2)?.status, "queued");
  assert.notEqual(afterTargeted.items.find((item) => item.position === 0)?.id, firstItem.id);
  assert.equal((await repository.wallet(owner)).balance, beforeTargeted);
  await repository.finish(unresolved, { errorCode: "STALE_COMPLETION", unknown: false });
  assert.equal((await repository.wallet(owner)).balance, beforeTargeted);
  assert.equal(
    (await sql`select count(*)::int as n from generation_retries where job_id=${batch.id}`)[0]?.n,
    1,
  );
  assert.equal(
    (
      await sql`select count(*)::int as n from generation_outbox where item_id in (select id from generation_job_items where job_id=${batch.id})`
    )[0]?.n,
    4,
  );
  // History deletion archives display state, never billing, source images or running work.
  await verifyArchivedTextileHistory(
    repository,
    owner,
    app,
    batch,
    other,
    thirdItem,
    store,
    png,
    references,
  );
}

async function verifyArchivedTextileHistory(
  repository: ImageRepository,
  owner: Awaited<ReturnType<ImageRepository["provision"]>>,
  app: ReturnType<typeof createApp>,
  batch: { id: string; replayed: boolean },
  other: Awaited<ReturnType<ImageRepository["provision"]>>,
  thirdItem: {
    id: string;
    position: number;
    status: "queued" | "running" | "succeeded" | "failed" | "needs_reconciliation";
    output_asset_id: string | null;
    error_code: string | null;
    width: number | null;
    height: number | null;
    worker_id: string | null;
    output_delivery?:
      | { url: string; thumbnail_url: string; download_url: string; expires_at: number }
      | undefined;
    output_public_id?: string | null | undefined;
  },
  store: ImageStore,
  png: Uint8Array<ArrayBufferLike>,
  references: string[],
) {
  const balanceBeforeDelete = (await repository.wallet(owner)).balance;
  const remove = (token: string) =>
    app.request(`/api/v1/image-tasks/${batch.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  assert.equal((await remove(other.token)).status, 404);
  assert.equal(
    (await repository.list(owner, 100)).some((row) => row.id === batch.id),
    true,
  );
  assert.equal((await remove(owner.token)).status, 200);
  assert.equal((await remove(owner.token)).status, 200);
  assert.equal(
    (await repository.list(owner, 100)).some((row) => row.id === batch.id),
    false,
  );
  assert.ok(await repository.get(owner, batch.id));
  assert.equal((await repository.wallet(owner)).balance, balanceBeforeDelete);
  const stillClaimable = await repository.claim(thirdItem.id, "archived-history-fixture", 60000);
  assert.ok(stillClaimable);
  await repository.finish(stillClaimable, {
    image: await store.put(owner, png, crypto.randomUUID()),
  });
  assert.equal((await repository.wallet(owner)).balance, balanceBeforeDelete);
  assert.equal(
    (await repository.list(owner, 100)).some((row) => row.id === batch.id),
    false,
  );
  assert.ok(await repository.asset(owner, references[0] ?? ""));
}
