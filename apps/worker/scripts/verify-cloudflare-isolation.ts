import assert from "node:assert/strict";
import { imageGenerationInputSchema, imageUnitCredits } from "@lycoboai/contracts";
import { openImageRepository } from "@lycoboai/db";
import type { ImageStore } from "@lycoboai/storage/core";
import type postgres from "postgres";

/** Runs only inside the disposable PostgreSQL database owned by the integration harness. */
export async function verifyCloudflareIsolation(
  databaseUrl: string,
  sql: postgres.Sql,
  store: ImageStore,
  png: Uint8Array,
) {
  const native = openImageRepository(databaseUrl);
  const cutoff = new Date(Date.now() - 60000);
  const edge = openImageRepository(databaseUrl, true, undefined, cutoff);
  try {
    const owner = await native.provision(`cf-${crypto.randomUUID()}`, "Cloudflare fixture", 100);
    const image = await store.put(owner, png);
    await Promise.all([native.addReference(owner, image), native.addReference(owner, image)]);
    const [references] =
      await sql`select count(*)::int as count from media_assets where id=${image.id}`;
    assert.equal(references?.count, 1);
    await assert.rejects(
      native.addReference(owner, { ...image, sha256: "0".repeat(64) }),
      /STATE_CONFLICT/,
    );
    const input = imageGenerationInputSchema.parse({
      model: "gpt-image-2",
      prompt: "Cloudflare isolated fixture",
      aspectRatio: "1:1",
      resolution: "1K",
      count: 1,
      referenceAssetIds: [],
    });
    const old = await native.create(owner, input, crypto.randomUUID(), imageUnitCredits);
    await sql`update generation_jobs set created_at=${new Date(cutoff.getTime() - 60000)} where id=${old.id}`;
    const [item] = await sql`select id from generation_job_items where job_id=${old.id}`;
    assert(item);
    await sql`update generation_job_items set created_at=${new Date(cutoff.getTime() - 60000)} where id=${item.id}`;
    assert.equal(await edge.claim(String(item.id), "fixture", 90000), null);
    const leased = await edge.leaseOutbox();
    assert(!leased.some((entry) => entry.itemId === String(item.id)));
    await sql`update generation_job_items set status='running',started_at=now()-interval '10 minutes',lease_expires_at=now()-interval '1 minute' where id=${item.id}`;
    await edge.expireClaims();
    const [after] = await sql`select status from generation_job_items where id=${item.id}`;
    assert.equal(after?.status, "running");
    await sql`update generation_job_items set status='failed',error_code='PROVIDER_TASK_FAILED' where id=${item.id}`;
    await edge.retry(owner, old.id, crypto.randomUUID());
    const [retry] =
      await sql`select id from generation_job_items where job_id=${old.id} and superseded_at is null`;
    assert(retry);
    assert(await edge.claim(String(retry.id), "explicit-user-retry", 90000));
    const fresh = await native.create(owner, input, crypto.randomUUID(), imageUnitCredits);
    const [freshItem] = await sql`select id from generation_job_items where job_id=${fresh.id}`;
    assert(freshItem);
    assert(await edge.claim(String(freshItem.id), "fixture", 90000));
    assert.equal(await edge.claim(String(freshItem.id), "duplicate", 90000), null);
  } finally {
    await Promise.all([native.close(), edge.close()]);
  }
}
