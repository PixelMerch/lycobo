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
  assert.equal(all.filter((entry) => entry.kind === "refund").length, 1);
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
  console.info(
    "Shared enterprise wallet: concurrent member spending, 20-coin pricing, per-image refunds, payment replay, ledger immutability, isolation and pagination passed",
  );
}
