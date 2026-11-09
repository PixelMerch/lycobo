import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  imageGenerationInputSchema,
  imageJobSchema,
  imageUnitCredits,
  latestImageEditResponseSchema,
  unwrapApiData,
} from "@lycoboai/contracts";
import type { ImageRepository } from "@lycoboai/db";
import type postgres from "postgres";

/** Real PostgreSQL invariants; caller owns a disposable migrated database. */
export async function verifyLocalEdits(
  repository: ImageRepository,
  sql: postgres.Sql,
  request: (path: string, init?: RequestInit) => Promise<Response>,
) {
  const owner = await repository.provision(
    `edit-${randomUUID()}`,
    "edit-fixture",
    6 * imageUnitCredits,
  );
  const other = await repository.provision(`edit-other-${randomUUID()}`, "other-fixture", 40);
  const sourceId = randomUUID();
  await repository.addReference(owner, {
    id: sourceId,
    objectKey: `fixture/${sourceId}`,
    mimeType: "image/png",
    width: 100,
    height: 100,
    bytes: 10,
    sha256: "a".repeat(64),
  });
  assert.equal(await repository.latestEdit(owner, sourceId), null);
  const input = imageGenerationInputSchema.parse({
    model: "gpt-image-2",
    prompt: "first-edit",
    referenceAssetIds: [sourceId],
    localEdit: {
      sourceAssetId: sourceId,
      width: 100,
      height: 100,
      regions: [{ id: randomUUID(), x: 10, y: 20, width: 30, height: 40, prompt: "蓝色" }],
    },
  });
  const edit = input.localEdit;
  if (!edit) throw new Error("Missing fixture edit");
  const key = randomUUID();
  const first = await repository.create(owner, input, key);
  assert.equal((await repository.create(owner, input, key)).id, first.id);
  assert.equal(
    (await sql`select count(*)::int as n from image_local_edits where job_id=${first.id}`)[0]?.n,
    1,
  );
  const secondInput = imageGenerationInputSchema.parse({
    ...input,
    prompt: "second-edit",
    localEdit: {
      ...input.localEdit,
      regions: [{ ...input.localEdit?.regions[0], prompt: "绿色" }],
    },
  });
  const second = await repository.create(owner, secondInput, randomUUID());
  // Stable ordering is verified independently from clock resolution.
  await sql`update image_local_edits set created_at=now()-interval '1 minute' where job_id=${first.id}`;
  const latest = imageJobSchema.parse(
    JSON.parse(JSON.stringify(await repository.latestEdit(owner, sourceId))),
  );
  assert.equal(latest.id, second.id);
  assert.equal(latest.input?.localEdit?.regions[0]?.prompt, "绿色");
  const endpoint = `/api/v1/image-assets/${sourceId}/latest-edit`;
  const response = await request(endpoint, { headers: { Authorization: `Bearer ${owner.token}` } });
  assert.equal(response.status, 200);
  assert.equal(
    latestImageEditResponseSchema.parse(unwrapApiData(await response.json())).job?.id,
    second.id,
  );
  assert.equal((await request(endpoint)).status, 401);
  assert.equal(
    (await request(endpoint, { headers: { Authorization: `Bearer ${other.token}` } })).status,
    404,
  );
  assert.equal((await repository.wallet(owner)).balance, 4 * imageUnitCredits);
  await assert.rejects(repository.latestEdit(other, sourceId), /NOT_FOUND/);
  await sql`insert into organization_members (organization_id,user_id,role) values (${owner.organizationId},${other.userId},'member')`;
  assert.equal(await repository.latestEdit({ ...owner, userId: other.userId }, sourceId), null);
  await assert.rejects(repository.create(other, input, randomUUID()), /REFERENCE_NOT_FOUND/);
  await assert.rejects(
    repository.create(owner, { ...input, localEdit: { ...edit, width: 99 } }, randomUUID()),
    /REFERENCE_NOT_FOUND/,
  );
  assert.equal(
    (
      await sql`select count(*)::int as n from image_local_edits where source_asset_id=${sourceId}`
    )[0]?.n,
    2,
  );
  assert.equal((await repository.wallet(owner)).balance, 4 * imageUnitCredits);
  // Failed billing rolls back task, lineage, debit and outbox together.
  await repository.create(
    owner,
    imageGenerationInputSchema.parse({ model: "gpt-image-2", prompt: "exhaust-fixture", count: 4 }),
    randomUUID(),
  );
  await assert.rejects(repository.create(owner, input, randomUUID()), /INSUFFICIENT_CREDITS/);
  assert.equal(
    (
      await sql`select count(*)::int as n from image_local_edits where source_asset_id=${sourceId}`
    )[0]?.n,
    2,
  );
}
