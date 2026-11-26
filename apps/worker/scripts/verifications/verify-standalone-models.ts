import assert from "node:assert/strict";
import { imageGenerationInputSchema, imageUnitCredits } from "@lycoboai/contracts";
import { openImageRepository } from "@lycoboai/db";
import { standaloneModels } from "@lycoboai/generation";
import type { ImageStore } from "@lycoboai/storage/core";
import type postgres from "postgres";
import { processImageItem } from "../../src/images/image-processor";
/** 在隔离临时库禁用目录后验证主站配置仍然可以持久化、扣费与投递。 */
export async function verifyStandaloneModels(
  url: string,
  sql: postgres.Sql,
  store: ImageStore,
  png: Buffer,
) {
  const configuration = await standaloneModels({
    STANDALONE_MODELS: "true",
    STANDALONE_IMAGE_API_KEY: "fixture-image",
    DEEPSEEK_API_KEY: "fixture-planner",
  });
  assert.ok(configuration);
  const repository = openImageRepository(url, false, configuration);
  const before = await sql`select code,enabled from model_catalog`;
  try {
    await sql`update model_catalog set enabled=0`;
    const owner = await repository.provision(
      `standalone:${crypto.randomUUID()}`,
      "standalone-fixture",
      200,
    );
    const input = imageGenerationInputSchema.parse({
      model: "gpt-image-2.6",
      prompt: "固定主站路由",
      resolution: "1K",
    });
    assert.equal((await repository.models.capabilities()).create?.length, 3);
    assert.equal((await repository.variation.config())?.model, "deepseek-flash");
    const key = crypto.randomUUID();
    const task = await repository.create(owner, input, key, 20, true);
    assert.equal((await repository.create(owner, input, key, 20, true)).replayed, true);
    const [row] = await sql`select provider_snapshot from generation_jobs where id=${task.id}`;
    assert.equal(row?.provider_snapshot.upstreamModel, "gpt-image-2.6");
    assert.equal(JSON.stringify(row?.provider_snapshot).includes("fixture-image"), false);
    assert.equal((await repository.wallet(owner)).balance, 200 - imageUnitCredits);
    const [outbox] =
      await sql`select count(*)::int as count from generation_outbox o join generation_job_items i on i.id=o.item_id where i.job_id=${task.id}`;
    assert.equal(outbox?.count, 1);
    const other = await repository.provision(`recovery-other:${crypto.randomUUID()}`, "other", 20);
    const [item] = await sql`select id from generation_job_items where job_id=${task.id}`;
    assert.ok(item);
    const claimed = await repository.claim(String(item.id), "crashed-fixture", 660000);
    assert.ok(claimed);
    const [lease] =
      await sql`select extract(epoch from (lease_expires_at-now()))::integer as seconds from generation_job_items where id=${item.id}`;
    assert.ok(Number(lease?.seconds) <= 90, "Crashes must not retain an eleven-minute lease");
    await repository.deferProvider(
      claimed,
      "original-fixture",
      "/v1/images/tasks/original-fixture?view=summary",
      2000,
    );
    await sql`update generation_job_items set started_at=now()-interval '181 seconds' where id=${item.id}`;
    const timed = await repository.get(owner, task.id);
    assert.equal(timed?.status, "needs_reconciliation");
    assert.equal((await repository.wallet(owner)).balance, 200 - imageUnitCredits);
    assert.equal((await repository.providerRetryCandidates(other, task.id)).length, 0);
    assert.equal((await repository.providerRetryCandidates(owner, task.id)).length, 1);
    await repository.resumeProvider(owner, task.id, String(item.id));
    assert.equal((await repository.get(owner, task.id))?.status, "queued");
    // 模拟队列等待跨过旧期限，领取时应恢复核对窗口而非重发生成。
    await sql`update provider_executions set deadline_at=now()-interval '1 minute' where item_id=${item.id}`;
    assert.equal(
      await repository.finish(claimed, { errorCode: "LATE_OLD_WORKER", unknown: true }),
      false,
    );
    let lookups = 0;
    await processImageItem(String(item.id), {
      repository,
      store,
      workerId: "recovery-fixture",
      standaloneKey: "fixture-image",
      overrides: {},
      editsEnabled: true,
      request: async (_url, init) => {
        assert.equal(init?.method, "GET", "Recovery must never POST a new image request");
        lookups++;
        return Response.json({ status: "success", data: [{ b64_json: png.toString("base64") }] });
      },
    });
    const recovered = await repository.get(owner, task.id);
    assert.equal(recovered?.status, "succeeded");
    assert.ok(recovered?.items[0].output_asset_id);
    assert.equal(lookups, 1);
    const [attempt] = await sql`select attempts from generation_job_items where id=${item.id}`;
    assert.equal(attempt?.attempts, 1);
    assert.equal(
      (await repository.wallet(owner)).balance,
      200 - imageUnitCredits,
      "Recovery must not charge or refund another attempt",
    );
  } finally {
    for (const row of before)
      await sql`update model_catalog set enabled=${row.enabled} where code=${row.code}`;
    await repository.close();
  }
}
