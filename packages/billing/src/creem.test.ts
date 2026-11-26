import { expect, it, vi } from "vitest";
import { creemBillingProvider } from "./creem";

const accountId = "cca_fixture";
const itemId = "4ec4d13f-e324-40cb-8ca4-39d4930a93da";
const debit = {
  itemId,
  accountId,
  approval: "mod_fixture",
  amount: 2,
};
const remoteDebit = {
  id: "cct_fixture",
  reversal_of: null,
  idempotency_key: `debit_${itemId}`,
  entries: [{ account_id: accountId, side: "debit", amount: "2" }],
};

it("authorizes every debit with its own approval and reconciles a lost response by its exact reference", async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockRejectedValueOnce(new Error("connection lost"))
    .mockResolvedValueOnce(Response.json({ data: [remoteDebit] }));
  const client = creemBillingProvider("creem_test_fixture", request);
  await expect(client.debit(debit)).resolves.toBe("cct_fixture");
  expect(request).toHaveBeenNthCalledWith(
    1,
    "https://test-api.creem.io/v1/customer-credits/accounts/cca_fixture/debit",
    expect.objectContaining({
      method: "POST",
      redirect: "manual",
      body: JSON.stringify({
        amount: "2",
        reference: `image:${itemId}`,
        idempotency_key: `debit_${itemId}`,
        moderation_id: debit.approval,
      }),
    }),
  );
  expect(request.mock.calls[1]?.[0]).toContain(encodeURIComponent(`image:${itemId}`));
});

it("declines insufficient balance only after checking for an already accepted debit", async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json({ error: { code: "insufficient_balance" } }, { status: 409 }),
    )
    .mockResolvedValueOnce(Response.json({ data: [] }));
  await expect(
    creemBillingProvider("creem_test_fixture", request).debit(debit),
  ).rejects.toMatchObject({ code: "INSUFFICIENT_CREDITS" });
});

it("creates checkout only for the configured one-time USD product with matching moderated credit delivery", async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json({
        price: 299,
        currency: "USD",
        billing_type: "onetime",
        status: "active",
        features: [
          {
            type: "customerCredits",
            customer_credits: { amount: "104", requires_moderation: true },
          },
        ],
      }),
    )
    .mockResolvedValueOnce(
      Response.json({ id: "ch_fixture", checkout_url: "https://checkout.creem.io/ch_fixture" }),
    );
  const buyer = {
    productId: "prod_fixture",
    customerId: "cust_fixture",
    orderId: itemId,
    successUrl: "https://lycobo.example/",
    amount: 299,
    credits: 104,
  };
  const client = creemBillingProvider("creem_test_fixture", request);
  await expect(client.checkout(buyer)).resolves.toEqual({
    id: "ch_fixture",
    url: "https://checkout.creem.io/ch_fixture",
  });
  const body = request.mock.calls[1]?.[1]?.body;
  expect(JSON.parse(String(body))).toMatchObject({
    customer: { id: "cust_fixture" },
    request_id: itemId,
  });

  request.mockReset().mockResolvedValueOnce(
    Response.json({
      price: 299,
      currency: "USD",
      billing_type: "onetime",
      status: "active",
      features: [
        {
          type: "customerCredits",
          customer_credits: { amount: "104", requires_moderation: false },
        },
      ],
    }),
  );
  await expect(client.checkout(buyer)).rejects.toMatchObject({ code: "BILLING_UNAVAILABLE" });
  expect(request).toHaveBeenCalledTimes(1);
});

it("never joins a buyer found by email with a different internal account", async () => {
  const request = vi.fn<typeof fetch>(async () =>
    Response.json({ id: "cust_fixture", external_id: "someone-else" }),
  );
  await expect(
    creemBillingProvider("creem_test_fixture", request).customer({
      userId: itemId,
      email: "test@example.com",
    }),
  ).rejects.toMatchObject({ code: "BILLING_UNAVAILABLE" });
  expect(request).toHaveBeenCalledTimes(1);
});
