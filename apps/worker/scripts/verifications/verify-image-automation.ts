import assert from "node:assert/strict";
import {
  type ImageScope,
  imageGenerationInputSchema,
  imageTaskPublicIdSchema,
  imageTasksResponseSchema,
  imageUnitCredits,
  unwrapApiData,
} from "@lycoboai/contracts";
import type { ImageRepository } from "@lycoboai/db";
import { openProviderKey, sealProviderKey } from "@lycoboai/generation";
import type postgres from "postgres";
import { z } from "zod";
import type { createApp } from "../../../api/src/app";

async function verifyAutomationSets(
  app: ReturnType<typeof createApp>,
  repository: ImageRepository,
  scope: ImageScope & { token: string },
  key: string,
) {
  const submissions = Array.from({ length: 10 }, (_, index) => {
    const explicitRatio = index === 0 ? "1:1" : "9:16";
    return {
      title: `Fixture set ${index + 1}`,
      requestId: crypto.randomUUID(),
      resolution: "2K",
      aspectRatio: index === 1 ? undefined : explicitRatio,
      images: Array.from({ length: 10 }, (_, position) => ({
        title: `Image ${position + 1}`,
        prompt: `Fixture product image ${position + 1}, aspect ratio 16:9`,
      })),
    };
  });
  const reply = z.object({
    result: z.object({ content: z.tuple([z.object({ text: z.string() })]) }),
  });
  const receipt = z.object({
    id: z.uuid(),
    publicId: imageTaskPublicIdSchema,
    aspectRatio: z.string(),
    replayed: z.boolean(),
  });
  const submit = async (input: (typeof submissions)[number]) => {
    const response = await app.request("/api/v1/enterprise/image-api/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "generate_image_set", arguments: input },
      }),
    });
    assert.equal(response.status, 200);
    const payload = reply.parse(await response.json());
    return receipt.parse(JSON.parse(payload.result.content[0].text));
  };
  const before = (await repository.wallet(scope)).balance;
  const accepted = [];
  for (const submission of submissions) accepted.push(await submit(submission));
  assert.equal(new Set(accepted.map(({ id }) => id)).size, 10);
  const [first] = submissions;
  assert.ok(first);
  // 旧客户端省略比例时，以原任务回执为准，保留方图和已扣积分。
  assert.deepEqual(await submit({ ...first, aspectRatio: undefined }), {
    id: accepted[0]?.id,
    publicId: accepted[0]?.publicId,
    aspectRatio: "1:1",
    replayed: true,
  });
  assert.equal((await repository.wallet(scope)).balance, before - 100 * imageUnitCredits);
  const history = await app.request("/api/v1/image-tasks?tool=variation", {
    headers: { Authorization: `Bearer ${scope.token}` },
  });
  assert.equal(history.status, 200);
  const { data: sets } = imageTasksResponseSchema.parse(unwrapApiData(await history.json()));
  assert.equal(sets.length, 10);
  const ratios = new Map(
    accepted.map(({ id, aspectRatio }, index) => {
      const expected = submissions[index]?.aspectRatio ?? "16:9";
      assert.equal(aspectRatio, expected);
      return [id, expected];
    }),
  );
  assert.ok(
    sets.every(
      (job) =>
        job.submission_source === "mcp" &&
        job.requested_count === 10 &&
        job.items.length === 10 &&
        job.aspect_ratio === ratios.get(job.id),
    ),
  );
}

/** 用隔离数据库验证企业 Key 的签发、并发更换、权限与结果归属。 */
export async function verifyImageAutomation(
  repository: ImageRepository,
  sql: postgres.Sql,
  app: ReturnType<typeof createApp>,
) {
  const ref = crypto.randomUUID();
  const scope = await repository.provision(
    `automation-${ref}`,
    "automation-fixture",
    105 * imageUnitCredits,
  );
  const other = await repository.provision(`automation-other-${ref}`, "automation-other", 0);
  const keys = repository.automation;
  const secret = Buffer.alloc(32, 2).toString("base64");
  const encryptionContext = `image-automation-key:${scope.organizationId}:${scope.userId}`;
  const seal = (key: string) => sealProviderKey(key, secret, encryptionContext);
  assert.equal(await keys.rotate(other, seal), null);
  await sql`insert into enterprise_accounts (account,user_id,organization_id,password_hash)
    values (${`automation-${ref}`},${scope.userId},${scope.organizationId},'fixture')`;
  assert.deepEqual(await keys.status(scope), { expiresAt: null });
  const [a, b] = await Promise.all([keys.rotate(scope, seal), keys.rotate(scope, seal)]);
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
  const { id, publicId } = await repository.create(
    scope,
    input,
    crypto.randomUUID(),
    imageUnitCredits,
  );
  const task = { id, publicId, aspectRatio: "1:1", status: "queued", asset_ids: [] };
  assert.deepEqual(await keys.result(scope, id), task);
  assert.deepEqual(await keys.result(scope, publicId), task);
  await sql`insert into organization_members (organization_id,user_id,role)
    values (${scope.organizationId},${other.userId},'member')`;
  assert.equal(await keys.result({ ...scope, userId: other.userId }, id), null);
  assert.equal(await keys.result({ ...scope, userId: other.userId }, publicId), null);
  assert.equal(await keys.result(other, id), null);
  const activeKey = (await keys.authenticate(a.key)) ? a.key : b.key;
  assert.equal((await keys.status(scope))?.lastFour, activeKey.slice(-4));
  assert.equal((await keys.status(scope))?.copyable, true);
  const ciphertext = await keys.keyCiphertext(scope);
  assert.ok(ciphertext && ciphertext !== activeKey);
  assert.equal(await openProviderKey(ciphertext, secret, encryptionContext), activeKey);
  await assert.rejects(openProviderKey(ciphertext, secret, `image-automation-key:${other.userId}`));
  assert.equal(await keys.keyCiphertext({ ...scope, userId: other.userId }), null);
  assert.equal(await keys.keyCiphertext(other), null);
  await verifyAutomationSets(app, repository, scope, activeKey);
  // 模拟只保留摘要的旧 Key，验证原凭据仍可用，但无法读取完整值。
  await sql`update generation_api_keys set key_suffix=null,key_ciphertext=null
    where organization_id=${scope.organizationId} and user_id=${scope.userId}`;
  assert.equal((await keys.status(scope))?.lastFour, undefined);
  assert.equal((await keys.status(scope))?.copyable, undefined);
  assert.equal(await keys.keyCiphertext(scope), null);
  assert.ok(await keys.authenticate(activeKey));
  assert.deepEqual(
    (await repository.list(scope, 20, undefined, "create")).map((job) => job.id),
    [id],
  );
  const replacement = await keys.rotate(scope, seal);
  assert.ok(replacement && (await keys.keyCiphertext(scope)));
  assert.equal(await keys.authenticate(activeKey), null);
  assert.ok(await keys.revoke(scope));
  assert.equal(await keys.authenticate(replacement.key), null);
  assert.equal(await keys.keyCiphertext(scope), null);
  assert.deepEqual(await keys.status(scope), { expiresAt: null });
}
