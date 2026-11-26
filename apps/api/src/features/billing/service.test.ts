import { expect, it, vi } from "vitest";
import { checkoutService } from "./service";

it.each([
  { key: "offer:trial", offset: 60_000, amount: 299, bonusCredits: 2 },
  { key: "regular:trial", offset: -60_000, amount: 449, bonusCredits: 0 },
])("pins the actual delivery and local bonus for $key", async (pack) => {
  const customer = { customerId: "cust_fixture", accountId: "cca_fixture" };
  const orderId = crypto.randomUUID();
  const reference = { id: "ch_fixture", url: "https://checkout.creem.io/fixture" };
  const repository = {
    billingCustomer: vi.fn(async () => customer),
    billingEmail: vi.fn(async () => "fixture@example.com"),
    saveBillingCustomer: vi.fn(async () => customer),
    createBillingOrder: vi.fn(async () => ({ id: orderId, url: null, fresh: true })),
    saveBillingCheckout: vi.fn(async () => {}),
  };
  const provider = {
    id: "creem-test",
    customer: vi.fn(async () => customer),
    checkout: vi.fn(async () => reference),
  };
  const checkout = checkoutService(repository, provider, {
    products: JSON.stringify({ [pack.key]: "prod_fixture" }),
    offerEnd: new Date(Date.now() + pack.offset).toISOString(),
    successUrl: "https://example.com/",
  });
  const scope = { userId: crypto.randomUUID(), organizationId: crypto.randomUUID() };
  const key = crypto.randomUUID();

  expect(await checkout.checkout(scope, key, pack.key)).toEqual({ url: reference.url });
  expect(repository.createBillingOrder).toHaveBeenCalledWith(
    scope,
    key,
    expect.objectContaining({ amount: pack.amount, credits: 102, bonusCredits: pack.bonusCredits }),
  );
  expect(provider.checkout).toHaveBeenCalledWith(
    expect.objectContaining({ orderId, amount: pack.amount, credits: 102 }),
  );
});
