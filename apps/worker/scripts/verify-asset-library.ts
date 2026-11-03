import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  assetFavoriteLimit,
  imageGenerationInputSchema,
  imageUnitCredits,
} from "@lycoboai/contracts";
import { type ImageRepository, ImageRepositoryError } from "@lycoboai/db";
import type postgres from "postgres";

/** Asset library filters and personal favorites; caller owns a disposable migrated database. */
export async function verifyAssetLibrary(repository: ImageRepository, sql: postgres.Sql) {
  const owner = await repository.provision(
    `library-${randomUUID()}`,
    "library-fixture",
    3 * imageUnitCredits,
  );
  const outsider = await repository.provision(`library-out-${randomUUID()}`, "library-out", 0);
  // A second member of the same organization sees the shared assets but keeps own favorites.
  const [colleagueUser] =
    await sql`insert into users (auth_subject) values (${`library-colleague-${randomUUID()}`}) returning id`;
  await sql`insert into organization_members (organization_id,user_id,role)
    values (${owner.organizationId},${String(colleagueUser?.id)},'member')`;
  const colleague = { organizationId: owner.organizationId, userId: String(colleagueUser?.id) };
  const image = (id: string) => ({
    id,
    objectKey: `fixtures/${id}.png`,
    mimeType: "image/png" as const,
    width: 4,
    height: 3,
    bytes: 10,
    sha256: "c".repeat(64),
  });
  // Outputs are attached to real tasks; tools come from input keys, models from provider variants.
  const output = async (inputKey: "textileSet" | "variation" | null, model: string) => {
    const input = imageGenerationInputSchema.parse({ model: "gpt-image-2", prompt: "library" });
    const job = await repository.create(owner, input, randomUUID());
    const [item] = await sql`select id from generation_job_items where job_id=${job.id}`;
    const id = randomUUID();
    await sql`insert into media_assets (id,organization_id,user_id,kind,media_type,object_key,mime_type,width,height,bytes,sha256)
      values (${id},${owner.organizationId},${owner.userId},'output','image',${`fixtures/${id}.png`},'image/png',4,3,10,${"c".repeat(64)})`;
    await sql`update generation_job_items set status='succeeded',output_asset_id=${id},completed_at=now() where id=${String(item?.id)}`;
    await sql`update generation_jobs set model=${model},
      input=case when ${inputKey}::text is null then input else input || jsonb_build_object(${inputKey}::text,'{}'::jsonb) end
      where id=${job.id}`;
    return id;
  };
  const created = await output(null, "gpt-image-2");
  const textile = await output("textileSet", "gpt-image-2.5-flare");
  const variation = await output("variation", "gpt-image-2");
  const upload = randomUUID();
  await repository.addReference(owner, image(upload));

  const ids = (rows: Array<Record<string, unknown>>) => rows.map((row) => String(row.id)).sort();
  const listed = await repository.listAssets(owner, 30);
  const byId = new Map(listed.map((row) => [String(row.id), row]));
  assert.equal(byId.get(created)?.tool, "create");
  assert.equal(byId.get(textile)?.tool, "textile");
  assert.equal(byId.get(textile)?.model, "gpt-image-2.5");
  assert.equal(byId.get(variation)?.tool, "variation");
  assert.equal(byId.get(upload)?.tool, null);
  assert.equal(byId.get(upload)?.favorite, false);
  const filtered = (filters: Parameters<ImageRepository["listAssets"]>[5]) =>
    repository.listAssets(owner, 30, undefined, undefined, undefined, filters);
  assert.deepEqual(ids(await filtered({ tool: "textile" })), [textile]);
  assert.deepEqual(ids(await filtered({ tool: "variation" })), [variation]);
  // Uploads have no task, so a tool filter never includes them.
  assert.deepEqual(ids(await filtered({ tool: "create" })), [created]);
  assert.deepEqual(ids(await filtered({ model: "gpt-image-2.5" })), [textile]);
  assert.deepEqual(ids(await filtered({ model: "gpt-image-2" })), [created, variation].sort());
  assert.deepEqual(ids(await filtered({ tool: "textile", model: "gpt-image-2" })), []);

  // Favorites are idempotent, personal and limited to assets the organization can still see.
  assert.equal(await repository.setAssetFavorite(owner, textile, true), true);
  assert.equal(await repository.setAssetFavorite(owner, textile, true), true);
  assert.equal(await repository.setAssetFavorite(owner, upload, true), true);
  assert.deepEqual(ids(await filtered({ favorite: true })), [textile, upload].sort());
  assert.deepEqual(ids(await filtered({ favorite: true, tool: "textile" })), [textile]);
  assert.deepEqual(
    [...(await repository.favoriteAssetIds(owner))].sort(),
    [textile, upload].sort(),
  );
  assert.deepEqual(await repository.favoriteAssetIds(colleague), []);
  assert.equal(
    (await repository.listAssets(colleague, 30)).find((row) => String(row.id) === textile)
      ?.favorite,
    false,
  );
  assert.equal(await repository.setAssetFavorite(outsider, textile, true), null);
  assert.equal(await repository.setAssetFavorite(owner, randomUUID(), true), null);
  assert.equal(await repository.setAssetFavorite(owner, textile, false), false);
  assert.equal(await repository.setAssetFavorite(owner, textile, false), false);
  assert.deepEqual(await repository.favoriteAssetIds(owner), [upload]);
  await sql`update media_assets set expires_at=now()-interval '1 second' where id=${upload}`;
  assert.deepEqual(await repository.favoriteAssetIds(owner), []);
  assert.equal(await repository.setAssetFavorite(owner, upload, true), null);

  // The limit counts visible favorites only and holds per member.
  await sql`insert into media_assets (organization_id,user_id,kind,media_type,object_key,mime_type,width,height,bytes,sha256)
    select ${owner.organizationId},${owner.userId},'output','image','fixtures/limit-'||${randomUUID()}||'-'||n,'image/png',4,3,10,${"c".repeat(64)}
    from generate_series(1,${assetFavoriteLimit}) n`;
  await sql`insert into image_asset_favorites (organization_id,user_id,asset_id)
    select organization_id,user_id,id from media_assets
    where organization_id=${owner.organizationId} and object_key like 'fixtures/limit-%'`;
  assert.equal((await repository.favoriteAssetIds(owner)).length, assetFavoriteLimit);
  await assert.rejects(
    repository.setAssetFavorite(owner, created, true),
    (error) => error instanceof ImageRepositoryError && error.code === "STATE_CONFLICT",
  );
  assert.equal(await repository.setAssetFavorite(colleague, created, true), true);
}
