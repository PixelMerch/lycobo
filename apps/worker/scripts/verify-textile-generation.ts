import assert from "node:assert/strict";
import {
  imageGenerationInputSchema,
  imageJobSchema,
  imageSubmissionResponseSchema,
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
  const app = createApp(() => {}, {
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
    count: 10,
    referenceAssetIds: references,
    textileSet: { version: 2, views: textileViews.map((view) => view.id) },
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
  assert.equal((await repository.wallet(owner)).balance, 800);
  const job = imageJobSchema.parse(
    JSON.parse(JSON.stringify(await repository.get(owner, submitted.id))),
  );
  assert.equal(job.items.length, 10);
  assert.equal(job.model, "gpt-image-2.5");
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
  const prompts: string[] = [];
  const request: typeof fetch = async (_url, init) => {
    assert(init?.body instanceof FormData);
    const prompt = String(init.body.get("prompt"));
    prompts.push(prompt);
    assert.equal(init.body.get("n"), "1");
    assert.equal(init.body.getAll("image[]").length, 6);
    assert.equal(init.body.get("model"), "gpt-image-2.5-sunburst");
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
  assert.equal((await repository.wallet(owner)).balance, 820);
  const retry = await repository.retry(owner, job.id, crypto.randomUUID());
  assert.equal(retry.id, job.id);
  assert.equal((await repository.wallet(owner)).balance, 800);
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
