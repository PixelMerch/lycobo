import assert from "node:assert/strict";
import { imageGenerationInputSchema, type StoredImage } from "@lycoboai/contracts";
import type { ImageRepository } from "@lycoboai/db";
import type postgres from "postgres";

/** Only called by the disposable, loopback integration database harness. */
export async function verifyReferenceRetention(repository: ImageRepository, sql: postgres.Sql) {
  const owner = await repository.provision(`retention:${crypto.randomUUID()}`, "retention", 100);
  const empty = await repository.provision(`retention-empty:${crypto.randomUUID()}`, "empty", 0);
  const asset = (): StoredImage => ({
    id: crypto.randomUUID(),
    objectKey: `fixtures/${crypto.randomUUID()}.png`,
    mimeType: "image/png",
    width: 2,
    height: 2,
    bytes: 10,
    sha256: "fixture",
  });
  const temporary = asset(),
    paid = asset(),
    rejected = asset();
  await repository.addReference(owner, temporary);
  await repository.addReference(owner, paid);
  await repository.addReference(empty, rejected);
  const [initial] =
    await sql`select expires_at-created_at as ttl from media_assets where id=${temporary.id}`;
  assert.ok(initial?.ttl);
  const [ttl] =
    await sql`select extract(epoch from (expires_at-created_at)) as seconds from media_assets where id=${temporary.id}`;
  assert.equal(Number(ttl?.seconds), 3 * 24 * 60 * 60);
  const input = (id: string) =>
    imageGenerationInputSchema.parse({
      model: "gpt-image-2",
      prompt: "retention fixture",
      referenceAssetIds: [id],
    });
  await assert.rejects(
    repository.create(empty, input(rejected.id), crypto.randomUUID()),
    /INSUFFICIENT_CREDITS/,
  );
  const [uncharged] = await sql`select expires_at from media_assets where id=${rejected.id}`;
  assert.ok(uncharged?.expires_at, "Failed payment must not promote uploads");
  const key = crypto.randomUUID();
  await repository.create(owner, input(paid.id), key);
  assert.equal((await repository.create(owner, input(paid.id), key)).replayed, true);
  const [promoted] = await sql`select expires_at from media_assets where id=${paid.id}`;
  assert.equal(promoted?.expires_at, null);
  await sql`update media_assets set expires_at=now()-interval '1 second' where id=${temporary.id}`;
  assert.equal(await repository.asset(owner, temporary.id), null);
  assert.equal(
    (await repository.listAssets(owner, 100)).some((row) => row.id === temporary.id),
    false,
  );
  await assert.rejects(
    repository.create(owner, input(temporary.id), crypto.randomUUID()),
    /REFERENCE_NOT_FOUND/,
  );
  assert.ok((await repository.expiredReferences()).some((row) => row.id === temporary.id));
  assert.ok(
    (await repository.expiredReferences()).some((row) => row.id === temporary.id),
    "Deletion failure remains retryable",
  );
  assert.equal(
    (await repository.expiredReferences()).some((row) => row.id === paid.id),
    false,
  );
  await repository.markReferenceDeleted(temporary.id);
  assert.equal(
    (await repository.expiredReferences()).some((row) => row.id === temporary.id),
    false,
  );
}
