import { createHmac } from "node:crypto";
import { expect, it, vi } from "vitest";
import { creemWebhookRoutes } from "./creem-webhook";

it("accepts only a signed event and forwards the original order, customer and product", async () => {
  const orderId = crypto.randomUUID();
  const confirmBillingOrder = vi.fn(async () => {});
  const refreshBillingAccount = vi.fn(async () => {});
  const secret = "creem-webhook-fixture";
  const app = creemWebhookRoutes(secret, { confirmBillingOrder, refreshBillingAccount });
  const body = JSON.stringify({
    eventType: "checkout.completed",
    object: {
      id: "ch_test",
      request_id: orderId,
      order: {
        product: "prod_test",
        customer: "cust_test",
        transaction: "tran_test",
        currency: "USD",
        status: "paid",
        amount: 299,
      },
    },
  });
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  expect((await app.request("/creem", { method: "POST", body })).status).toBe(401);
  expect(confirmBillingOrder).not.toHaveBeenCalled();
  expect(
    (
      await app.request("/creem", {
        method: "POST",
        body,
        headers: { "creem-signature": signature },
      })
    ).status,
  ).toBe(200);
  expect(confirmBillingOrder).toHaveBeenCalledWith({
    id: orderId,
    provider: "creem",
    checkoutId: "ch_test",
    productId: "prod_test",
    customerId: "cust_test",
    transactionId: "tran_test",
    amount: 299,
  });
  expect(refreshBillingAccount).not.toHaveBeenCalled();
});
