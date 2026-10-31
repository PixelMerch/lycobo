import assert from "node:assert/strict";
import { imageGenerationInputSchema, imageUnitCredits } from "@lycoboai/contracts";
import { openImageRepository } from "@lycoboai/db";
import { standaloneModels } from "@lycoboai/generation";
import type postgres from "postgres";
/** 在隔离临时库禁用目录后验证主站配置仍然可以持久化、扣费与投递。 */
export async function verifyStandaloneModels(url: string, sql: postgres.Sql) {
  const configuration = await standaloneModels({
    STANDALONE_MODELS: "true",
    STANDALONE_IMAGE_API_KEY: "fixture-image",
    STANDALONE_PLANNER_API_KEY: "fixture-planner",
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
      model: "gpt-image-2.5",
      prompt: "固定主站路由",
      resolution: "1.5K",
    });
    assert.equal((await repository.models.capabilities()).create?.length, 4);
    assert.equal((await repository.variation.config())?.model, "claude-sonnet-5");
    const key = crypto.randomUUID();
    const task = await repository.create(owner, input, key, 20, true);
    assert.equal((await repository.create(owner, input, key, 20, true)).replayed, true);
    const [row] = await sql`select provider_snapshot from generation_jobs where id=${task.id}`;
    assert.equal(row?.provider_snapshot.upstreamModel, "gpt-image-2.5-sunburst");
    assert.equal(JSON.stringify(row?.provider_snapshot).includes("fixture-image"), false);
    assert.equal((await repository.wallet(owner)).balance, 200 - imageUnitCredits);
    const [outbox] =
      await sql`select count(*)::int as count from generation_outbox o join generation_job_items i on i.id=o.item_id where i.job_id=${task.id}`;
    assert.equal(outbox?.count, 1);
  } finally {
    for (const row of before)
      await sql`update model_catalog set enabled=${row.enabled} where code=${row.code}`;
    await repository.close();
  }
}
