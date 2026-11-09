import assert from "node:assert/strict";
import {
  imageGenerationInputSchema,
  imageUnitCredits,
  type StoredImage,
  unwrapApiData,
  variationPlanSchema,
} from "@lycoboai/contracts";
import type { ImageRepository } from "@lycoboai/db";
import {
  sealProviderKey,
  supportedResolutions,
  textileItemInput,
  validateModelInput,
} from "@lycoboai/generation";
import type { ImageStore } from "@lycoboai/storage/core";
import type postgres from "postgres";
import { createApp } from "../../../api/src/app";

/** Paid upstream requests are replaced only in this disposable integration harness. */
export async function verifyVariationPlans(
  repository: ImageRepository,
  sql: postgres.Sql,
  store: ImageStore,
  png: Buffer,
) {
  const owner = await repository.provision(`variation:${crypto.randomUUID()}`, "variation", 1000);
  const other = await repository.provision(`variation-other:${crypto.randomUUID()}`, "other", 100);
  const secret = Buffer.alloc(32, 4).toString("base64");
  const provider = await repository.models.saveProvider(
    owner.userId,
    undefined,
    {
      name: "Planner fixture",
      origin: "https://planner.example.com",
      adapter: "openai-images",
      enabled: true,
    },
    await sealProviderKey("fixture-only", secret),
  );
  await sql`insert into model_planners(tool,provider_id,origin,upstream_model,enabled) values('smart-variation',${provider.id},'https://planner.example.com','gpt-6-luna',1)`;
  const asset = await store.put(owner, png);
  await repository.addReference(owner, asset);
  let calls = 0;
  const plannerRequest: typeof fetch = async (_url, init) => {
    calls++;
    if (String(init?.body).includes("网络异常测试")) throw new Error("fixture-network");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer fixture-only");
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                items: Array.from({ length: 20 }, (_, i) => ({
                  title: `方案${i}`,
                  prompt: `参考图1，独立商品场景方案${i}，保留商品主体。`,
                })),
              }),
            },
            finish_reason: "stop",
          },
        ],
      }),
    );
  };
  const app = createApp(undefined, {
    repository,
    store,
    modelSecret: secret,
    plannerRequest,
    enabled: true,
    editsEnabled: true,
    unitCredits: 20,
    validate: (i) => validateModelInput(i, {}, true),
    resolutions: supportedResolutions,
  });
  const headers = {
    Authorization: `Bearer ${owner.token}`,
    "Content-Type": "application/json",
    "Idempotency-Key": crypto.randomUUID(),
  };
  const input = { description: "为商品给二十个独立场景", referenceAssetIds: [asset.id] };
  const post = () =>
    app.request("/api/v1/variation-plans", {
      method: "POST",
      headers,
      body: JSON.stringify(input),
    });
  const response = await post();
  assert.equal(response.status, 200);
  const plan = variationPlanSchema.parse(unwrapApiData(await response.json()));
  assert.equal(plan.status, "ready");
  assert.equal(plan.items.length, 20);
  assert.equal((await post()).status, 200);
  assert.equal(calls, 1, "Analysis replay must not call provider");
  assert.equal(
    (
      await app.request(`/api/v1/variation-plans/${plan.id}`, {
        headers: { Authorization: `Bearer ${other.token}` },
      })
    ).status,
    404,
  );
  assert.equal(
    (await repository.wallet(owner)).balance,
    1000,
    "Analysis must not debit image credits",
  );
  await verifyConfirmedVariation(asset, plan, repository, owner, sql, other);
  const unknownHeaders = { ...headers, "Idempotency-Key": crypto.randomUUID() };
  const uncertainPost = () =>
    app.request("/api/v1/variation-plans", {
      method: "POST",
      headers: unknownHeaders,
      body: JSON.stringify({ description: "网络异常测试", referenceAssetIds: [] }),
    });
  const uncertain = variationPlanSchema.parse(unwrapApiData(await (await uncertainPost()).json()));
  assert.equal(uncertain.status, "uncertain");
  const beforeReplay = calls;
  await uncertainPost();
  assert.equal(calls, beforeReplay);
  assert.equal(
    (await repository.wallet(owner)).balance,
    1000 - 20 * imageUnitCredits,
    "Uncertain analysis must not debit image credits",
  );
  await sql`delete from model_planners where tool='smart-variation'`;
}

async function verifyConfirmedVariation(
  asset: StoredImage,
  plan: ReturnType<typeof variationPlanSchema.parse>,
  repository: ImageRepository,
  owner: Awaited<ReturnType<ImageRepository["provision"]>>,
  sql: postgres.Sql,
  other: Awaited<ReturnType<ImageRepository["provision"]>>,
) {
  const generation = imageGenerationInputSchema.parse({
    model: "gpt-image-2.5",
    prompt: "智能裂变",
    count: 20,
    referenceAssetIds: [asset.id],
    variation: { version: 1, planId: plan.id, items: plan.items },
  });
  const key = crypto.randomUUID();
  const created = await repository.create(owner, generation, key);
  assert.equal((await repository.create(owner, generation, key)).replayed, true);
  assert.equal((await repository.wallet(owner)).balance, 1000 - 20 * imageUnitCredits);
  const job = await repository.get(owner, created.id);
  assert.ok(job);
  assert.equal(job.items.length, 20);
  const [outbox] =
    await sql`select count(*)::integer as count from generation_outbox o join generation_job_items i on i.id=o.item_id where i.job_id=${created.id}`;
  assert.equal(
    Number(outbox?.count),
    20,
    "Each confirmed plan requires a distinct durable delivery",
  );
  for (let i = 0; i < 20; i++)
    assert.ok(textileItemInput(generation, i).prompt.includes(`方案${i}`));
  assert.equal((await repository.list(owner, 20, undefined, "variation")).length, 1);
  assert.equal((await repository.list(owner, 20, undefined, "create")).length, 0);
  await assert.rejects(
    repository.create(other, generation, crypto.randomUUID()),
    /REFERENCE_NOT_FOUND|STATE_CONFLICT/,
  );
  await assert.rejects(
    repository.create(
      owner,
      { ...generation, variation: { version: 1, items: plan.items, planId: crypto.randomUUID() } },
      crypto.randomUUID(),
    ),
    /STATE_CONFLICT/,
  );
}
