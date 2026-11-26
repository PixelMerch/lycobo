import assert from "node:assert/strict";
import { imageGenerationInputSchema, imageUnitCredits } from "@lycoboai/contracts";
import type { ImageRepository } from "@lycoboai/db";
import type postgres from "postgres";

/** 用隔离数据库验证企业 Key 的签发、并发更换、权限与结果归属。 */
export async function verifyImageAutomation(repository: ImageRepository, sql: postgres.Sql) {
  const ref = crypto.randomUUID();
  const scope = await repository.provision(`automation-${ref}`, "automation-fixture", 10);
  const other = await repository.provision(`automation-other-${ref}`, "automation-other", 0);
  const keys = repository.automation;
  assert.equal(await keys.rotate(other), null);
  await sql`insert into enterprise_accounts (account,user_id,organization_id,password_hash)
    values (${`automation-${ref}`},${scope.userId},${scope.organizationId},'fixture')`;
  assert.deepEqual(await keys.status(scope), { expiresAt: null });
  const [a, b] = await Promise.all([keys.rotate(scope), keys.rotate(scope)]);
  assert.ok(a && b);
  const active = (await Promise.all([keys.authenticate(a.key), keys.authenticate(b.key)])).filter(
    Boolean,
  );
  assert.equal(active.length, 1);
  assert.equal(active[0]?.userId, scope.userId);
  assert.ok((await keys.status(scope))?.expiresAt);
  assert.equal(await repository.authenticate(a.key), null);
  assert.ok(await repository.authenticate(scope.token));

  const input = imageGenerationInputSchema.parse({
    model: "gpt-image-2",
    prompt: "automation fixture",
  });
  const { id } = await repository.create(scope, input, crypto.randomUUID(), imageUnitCredits);
  assert.deepEqual(await keys.result(scope, id), { status: "queued", asset_ids: [] });
  await sql`insert into organization_members (organization_id,user_id,role)
    values (${scope.organizationId},${other.userId},'member')`;
  assert.equal(await keys.result({ ...scope, userId: other.userId }, id), null);
  assert.equal(await keys.result(other, id), null);
  assert.ok(await keys.revoke(scope));
  assert.equal(await keys.authenticate(a.key), null);
  assert.equal(await keys.authenticate(b.key), null);
  assert.deepEqual(await keys.status(scope), { expiresAt: null });
}
