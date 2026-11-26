import assert from "node:assert/strict";
import { BillingError, type BillingProvider, settleGenerationCredits } from "@lycoboai/billing";
import { type ImageScope, imageGenerationInputSchema } from "@lycoboai/contracts";
import type { ImageRepository } from "@lycoboai/db";
import type postgres from "postgres";

async function verifySplitOrder(
  repository: ImageRepository,
  sql: postgres.Sql,
  scope: ImageScope,
  customerId: string,
  providerId: string,
) {
  const order = await repository.createBillingOrder(scope, crypto.randomUUID(), {
    provider: providerId,
    productId: "prod_fixture",
    customerId,
    credits: 102,
    bonusCredits: 2,
    amount: 299,
  });
  const payment = {
    id: order.id,
    provider: providerId,
    checkoutId: "ch_fixture",
    productId: "prod_fixture",
    customerId,
    transactionId: "tran_fixture",
    amount: 299,
  };
  await repository.confirmBillingOrder({ ...payment, amount: 1 });
  assert.equal((await repository.billingOrders(scope, 10))[0]?.status, "pending");
  assert.equal((await repository.wallet(scope)).balance, 10);
  await Promise.all([
    repository.confirmBillingOrder(payment),
    repository.confirmBillingOrder(payment),
  ]);
  const [paid] = await repository.billingOrders(scope, 10);
  assert.equal(paid?.status, "paid");
  assert.equal(paid?.credits, 104);
  assert.equal((await repository.wallet(scope)).balance, 12);
  const statement = await repository.walletEntries(scope, 10);
  assert.deepEqual(
    statement.filter((entry) => entry.recharge_id === order.id).map((entry) => entry.amount),
    [2],
  );
  const other = await repository.provision(
    `billing-other-${crypto.randomUUID()}`,
    "billing-other-fixture",
    0,
  );
  const [otherWallet] =
    await sql`select id from organization_wallets where organization_id=${other.organizationId}`;
  assert.ok(otherWallet);
  // 即使绕过应用服务，原订单的赠送积分也不能写到其他工作区。
  await assert.rejects(
    sql`insert into wallet_entries(wallet_id,user_id,event_key,kind,amount,balance_after,billing_order_id)
      values (${otherWallet.id},${scope.userId},${`billing-bonus:${order.id}`},'recharge',2,2,${order.id})`,
    /WALLET_RECHARGE_MISMATCH/,
  );
}

/** 在隔离数据库验证订单赠送分账、逐图消费、冲正和重放。 */
export async function verifyBilling(repository: ImageRepository, sql: postgres.Sql) {
  const scope = await repository.provision(`billing-${crypto.randomUUID()}`, "billing-fixture", 10);
  const buyer = { customerId: "cust_fixture", accountId: "cca_fixture" };
  const providerId = "billing-fixture";
  await repository.saveBillingCustomer(scope, providerId, buyer);
  await verifySplitOrder(repository, sql, scope, buyer.customerId, providerId);

  const debits = new Map<string, string>();
  const reversals = new Set<string>();
  const provider: BillingProvider = {
    id: providerId,
    customer: async () => buyer,
    checkout: async () => {
      throw new Error("UNEXPECTED_CHECKOUT");
    },
    balance: async () => 102 - 2 * (debits.size - reversals.size),
    debit: async ({ itemId, approval }) => {
      assert.match(approval, /^approval-/);
      if (approval === "approval-declined") throw new BillingError("INSUFFICIENT_CREDITS");
      const id = debits.get(itemId) ?? crypto.randomUUID();
      debits.set(itemId, id);
      return id;
    },
    reverse: async (_accountId, transactionId) => {
      reversals.add(transactionId);
    },
  };
  const input = imageGenerationInputSchema.parse({
    model: "gpt-image-2",
    prompt: "billing fixture",
    count: 2,
  });
  const key = crypto.randomUUID();
  const credit = {
    provider: provider.id,
    accountId: buyer.accountId,
    approvals: new Map([
      [0, "approval-first"],
      [1, "approval-declined"],
    ]),
  };
  const task = await repository.create(scope, input, key, 2, false, [], credit);
  assert.equal((await repository.replayImageSubmission(scope, input, key))?.id, task.id);
  const items =
    await sql`select id,position from generation_job_items where job_id=${task.id} order by position`;
  const first = String(items[0]?.id);
  assert.equal(await repository.claim(first, "billing-fixture", 1000), null);
  assert.equal(
    (await repository.leaseOutbox()).some((row) => row.itemId === first),
    false,
  );
  await Promise.all([
    settleGenerationCredits(provider, repository, task.id),
    settleGenerationCredits(provider, repository, task.id),
  ]);
  assert.equal(debits.size, 1);
  assert.equal(await provider.balance(buyer.accountId), 100);
  const claimed = await repository.claim(first, "billing-fixture", 1500);
  assert.ok(claimed);
  await repository.finish(claimed, { errorCode: "PROVIDER_TEST_FAILED", unknown: false });
  await settleGenerationCredits(provider, repository, task.id);
  await settleGenerationCredits(provider, repository, task.id);
  assert.equal(reversals.size, 1);
  assert.equal(await provider.balance(buyer.accountId), 102);
  assert.equal((await repository.wallet(scope)).balance, 12);
  const entries = await repository.billingEntries(scope, provider.id, 10);
  assert.deepEqual(
    entries.map((entry) => [entry.kind, entry.amount]),
    [
      ["refund", 2],
      ["consume", -2],
      ["recharge", 102],
    ],
  );

  const failed = await repository.get(scope, task.id);
  assert.equal(failed?.status, "failed");
  assert.equal(failed?.items[1]?.error_code, "INSUFFICIENT_CREDITS");
}
