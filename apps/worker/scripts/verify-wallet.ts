import assert from "node:assert/strict";
import { imageGenerationInputSchema, imageUnitCredits } from "@lycoboai/contracts";
import type { ImageRepository } from "@lycoboai/db";
import type postgres from "postgres";

export async function verifyWallet(repository: ImageRepository, sql: postgres.Sql) {
  const owner = await repository.provision(
    `wallet:${crypto.randomUUID()}`,
    "shared-wallet-fixture",
    60,
  );
  const [member] =
    await sql`insert into users (auth_subject) values (${`member:${crypto.randomUUID()}`}) returning id`;
  assert.ok(member);
  await sql`insert into organization_members (organization_id,user_id) values (${owner.organizationId},${member.id})`;
  const child = { organizationId: owner.organizationId, userId: String(member.id) };
  const input = imageGenerationInputSchema.parse({
    model: "gpt-image-2",
    resolution: "2K",
    prompt: "wallet-fixture",
  });
  const submissions = await Promise.allSettled(
    [owner, child, owner, child].map((scope) =>
      repository.create(scope, input, crypto.randomUUID(), 1),
    ),
  );
  assert.equal(submissions.filter((result) => result.status === "fulfilled").length, 3);
  assert.equal(submissions.filter((result) => result.status === "rejected").length, 1);
  assert.equal((await repository.wallet(owner)).balance, 0);
  assert.equal((await repository.wallet(child)).balance, 0);
  const charged = await repository.walletEntries(owner, 100);
  assert.equal(charged.filter((entry) => entry.kind === "consume").length, 3);
  assert.ok(
    charged
      .filter((entry) => entry.kind === "consume")
      .every((entry) => entry.amount === -imageUnitCredits),
  );
  assert.equal(
    new Set(charged.filter((entry) => entry.kind === "consume").map((entry) => entry.user_uid))
      .size,
    2,
  );
  const accepted = submissions.find((result) => result.status === "fulfilled");
  assert.ok(accepted?.status === "fulfilled");
  const [item] =
    await sql`select i.id,j.provider_model from image_job_items i join image_jobs j on j.id=i.job_id where j.id=${accepted.value.id}`;
  assert.equal(item?.provider_model, "gpt-image-2-4K");
  const claim = await repository.claim(String(item?.id), "wallet-fixture", 1000);
  assert.ok(claim);
  assert.equal(claim.providerModel, "gpt-image-2-4K");
  assert.equal(
    await repository.finish(claim, { errorCode: "FIXTURE_FAILED", unknown: false }),
    true,
  );
  assert.equal(
    await repository.finish(claim, { errorCode: "FIXTURE_FAILED", unknown: false }),
    false,
  );
  assert.equal((await repository.wallet(child)).balance, 20);
  const original = await repository.get(owner, accepted.value.id);
  const retryKey = crypto.randomUUID();
  const retries = await Promise.all(
    Array.from({ length: 4 }, () => repository.retry(owner, accepted.value.id, retryKey)),
  );
  assert.equal(retries.filter((entry) => !entry.replayed).length, 1);
  assert.ok(retries.every((entry) => entry.id === accepted.value.id));
  const retried = await repository.get(owner, accepted.value.id);
  assert.equal(retried?.public_id, original?.public_id);
  assert.equal(retried?.items.length, 1);
  assert.notEqual(retried?.items[0].id, item?.id);
  assert.equal((await repository.wallet(owner)).balance, 0);
  await assert.rejects(
    repository.retry(child, accepted.value.id, crypto.randomUUID()),
    /STATE_CONFLICT/,
  );
  await assert.rejects(
    repository.claim(String(item?.id), "stale-worker", 1000).then((claim) => {
      if (!claim) throw new Error("STALE_CLAIM_REJECTED");
    }),
    /STALE_CLAIM_REJECTED/,
  );
  const retryClaim = await repository.claim(String(retried?.items[0].id), "retry-worker", 1000);
  assert.ok(retryClaim);
  await repository.finish(retryClaim, {
    errorCode: "PROVIDER_INVALID_IMAGE_RESPONSE",
    unknown: true,
  });
  assert.equal((await repository.get(owner, accepted.value.id))?.status, "failed");
  assert.equal((await repository.wallet(owner)).balance, 20);
  assert.equal((await repository.retry(owner, accepted.value.id, retryKey)).replayed, true);
  await sql`update image_job_items set status='needs_reconciliation' where id=${retryClaim.itemId}`;
  await Promise.all([repository.settleInvalidResponses(), repository.settleInvalidResponses()]);
  assert.equal((await repository.wallet(owner)).balance, 20);
  assert.equal((await repository.get(owner, accepted.value.id))?.status, "failed");
  await assert.rejects(
    repository.retry(
      { organizationId: crypto.randomUUID(), userId: owner.userId },
      accepted.value.id,
      crypto.randomUUID(),
    ),
    /FORBIDDEN/,
  );
  const creditInput = {
    key: crypto.randomUUID(),
    credits: 100,
    amountMinor: 1000,
    channel: "fixture",
  };
  const order = await repository.createRecharge(owner, creditInput);
  assert.equal((await repository.createRecharge(owner, creditInput)).replayed, true);
  await assert.rejects(
    repository.createRecharge(owner, { ...creditInput, credits: 101 }),
    /IDEMPOTENCY_CONFLICT/,
  );
  assert.equal((await repository.wallet(owner)).balance, 20);
  const payment = {
    id: order.id,
    transactionId: crypto.randomUUID(),
    channel: "fixture",
    currency: "CNY",
    amountMinor: 1000,
  };
  await assert.rejects(
    repository.settleRecharge({ ...payment, amountMinor: 999 }),
    /STATE_CONFLICT/,
  );
  const results = await Promise.all(
    Array.from({ length: 5 }, () => repository.settleRecharge(payment)),
  );
  assert.equal(results.filter((result) => !result.replayed).length, 1);
  assert.equal((await repository.wallet(child)).balance, 120);
  const otherOrder = await repository.createRecharge(owner, {
    ...creditInput,
    key: crypto.randomUUID(),
  });
  await assert.rejects(
    repository.settleRecharge({ ...payment, id: otherOrder.id }),
    /recharge_provider_unique/,
  );
  assert.equal((await repository.wallet(owner)).balance, 120);
  const all = await repository.walletEntries(owner, 100);
  assert.equal(
    all.reduce((sum, entry) => sum + Number(entry.amount), 0),
    120,
  );
  assert.equal(all.filter((entry) => entry.kind === "refund").length, 2);
  assert.equal(all.filter((entry) => entry.kind === "recharge").length, 1);
  const page = await repository.walletEntries(child, 2);
  const next = await repository.walletEntries(owner, 100, String(page.at(-1)?.id));
  assert.equal(new Set([...page, ...next].map((entry) => entry.id)).size, all.length);
  const outsider = await repository.provision(
    `wallet-other:${crypto.randomUUID()}`,
    "other-wallet",
    0,
  );
  assert.equal((await repository.walletEntries(outsider, 100)).length, 0);
  assert.equal((await repository.rechargeOrders(outsider, 100)).length, 0);
  await assert.rejects(
    sql`update wallet_entries set amount=999 where id=${all[0]?.id}`,
    /WALLET_LEDGER_IMMUTABLE/,
  );
  await assert.rejects(
    sql`delete from wallet_entries where id=${all[0]?.id}`,
    /WALLET_LEDGER_IMMUTABLE/,
  );
  const before = (await repository.wallet(owner)).balance;
  const key = crypto.randomUUID();
  const multi = imageGenerationInputSchema.parse({
    model: "nano-banana-2.1",
    prompt: "four-images",
    count: 4,
  });
  const repeated = await Promise.all(
    Array.from({ length: 4 }, () => repository.create(child, multi, key)),
  );
  assert.equal(new Set(repeated.map((job) => job.id)).size, 1);
  assert.equal((await repository.wallet(owner)).balance, before - 80);
  const repeatedId = repeated[0]?.id;
  assert.ok(repeatedId);
  const [saved] = await sql`select provider_model from image_jobs where id=${repeatedId}`;
  assert.equal(saved?.provider_model, "gemini-nano-banana-2.1");
  const refundItems = await sql`select id from image_job_items where job_id=${repeatedId}`;
  for (const row of refundItems) {
    const attempt = await repository.claim(String(row.id), "refund-fixture", 1000);
    assert.ok(attempt);
    await repository.finish(attempt, { errorCode: "FIXTURE_FAILED", unknown: false });
  }
  assert.equal((await repository.wallet(owner)).balance, before);
  // An explicit user retry replaces an unresolved attempt; automatic workers
  // still leave it untouched until that decision is made.
  const manual = await repository.provision(
    `manual:${crypto.randomUUID()}`,
    "manual-retry-fixture",
    40,
  );
  const manualJob = await repository.create(manual, input, crypto.randomUUID());
  const manualView = await repository.get(manual, manualJob.id);
  const unresolved = await repository.claim(
    String(manualView?.items[0].id),
    "unknown-worker",
    1000,
  );
  assert.ok(unresolved);
  await repository.finish(unresolved, { errorCode: "PROVIDER_OUTCOME_UNKNOWN", unknown: true });
  assert.equal((await repository.wallet(manual)).balance, 20);
  const manualKey = crypto.randomUUID();
  const manualRetries = await Promise.all(
    Array.from({ length: 3 }, () => repository.retry(manual, manualJob.id, manualKey)),
  );
  assert.equal(manualRetries.filter((entry) => !entry.replayed).length, 1);
  const manualResult = await repository.get(manual, manualJob.id);
  assert.equal(manualResult?.public_id, manualView?.public_id);
  assert.equal(manualResult?.status, "queued");
  assert.equal(manualResult?.items.length, 1);
  assert.equal((await repository.wallet(manual)).balance, 20);
  const manualEntries = await repository.walletEntries(manual, 100);
  assert.equal(manualEntries.filter((entry) => entry.kind === "refund").length, 1);
  assert.equal(manualEntries.filter((entry) => entry.kind === "consume").length, 2);
  const [retired] =
    await sql`select superseded_at,reconciliation_evidence,reconciled_by from image_job_items where id=${unresolved.itemId}`;
  assert.ok(retired?.superseded_at);
  assert.equal(retired?.reconciled_by, manual.userId);
  assert.match(String(retired?.reconciliation_evidence), /User requested retry/);
  assert.equal(
    await repository.finish(unresolved, {
      image: {
        id: crypto.randomUUID(),
        objectKey: "late-output",
        mimeType: "image/png",
        width: 2,
        height: 2,
        bytes: 67,
        sha256: "0".repeat(64),
      },
    }),
    false,
  );
  assert.equal((await repository.wallet(manual)).balance, 20);
  assert.equal((await repository.retry(manual, manualJob.id, manualKey)).replayed, true);
  const legacy = await repository.provision(
    `legacy:${crypto.randomUUID()}`,
    "legacy-invalid-response",
    40,
  );
  const legacyJob = await repository.create(legacy, input, crypto.randomUUID());
  const legacyView = await repository.get(legacy, legacyJob.id);
  const legacyClaim = await repository.claim(
    String(legacyView?.items[0].id),
    "legacy-worker",
    1000,
  );
  assert.ok(legacyClaim);
  await repository.finish(legacyClaim, { errorCode: "OUTPUT_OUTCOME_UNKNOWN", unknown: true });
  assert.equal((await repository.wallet(legacy)).balance, 20);
  await sql`update image_job_items set error_code='PROVIDER_INVALID_IMAGE_RESPONSE' where id=${legacyClaim.itemId}`;
  await Promise.all([repository.settleInvalidResponses(), repository.settleInvalidResponses()]);
  assert.equal((await repository.wallet(legacy)).balance, 40);
  assert.equal(
    (await repository.walletEntries(legacy, 100)).filter((entry) => entry.kind === "refund").length,
    1,
  );
  assert.equal(
    await repository.finish(claim, { errorCode: "STALE_ATTEMPT", unknown: false }),
    false,
  );
  console.info(
    "Shared enterprise wallet: concurrent member spending, 20-coin pricing, per-image refunds, payment replay, ledger immutability, isolation and pagination passed",
  );
}
