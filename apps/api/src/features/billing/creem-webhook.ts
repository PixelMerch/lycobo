import { createHmac, timingSafeEqual } from "node:crypto";
import type { ImageRuntimeRepository } from "@lycoboai/db";
import { Hono } from "hono";
import { z } from "zod";

const event = z.object({ eventType: z.string(), object: z.unknown() });
const externalId = z.string().min(1).max(120);
const payment = z.object({
  id: externalId,
  request_id: z.uuid(),
  order: z.object({
    product: externalId,
    customer: externalId,
    transaction: externalId,
    currency: z.literal("USD"),
    status: z.literal("paid"),
    amount: z.number().int().positive(),
  }),
});
const grant = z.object({ customer_id: externalId, account_id: externalId });

function verified(secret: string, signature: string | undefined, body: Uint8Array) {
  if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  return timingSafeEqual(
    createHmac("sha256", secret).update(body).digest(),
    Buffer.from(signature, "hex"),
  );
}

function json(raw: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return null;
  }
}

/** 验证原始请求签名，再按本地订单关联核对支付；积分由 Creem 自动发放。 */
export function creemWebhookRoutes(
  secret: string,
  repository: Pick<ImageRuntimeRepository, "confirmBillingOrder" | "refreshBillingAccount">,
  provider = "creem",
) {
  const app = new Hono();
  app.post("/creem", async (c) => {
    const raw = new Uint8Array(await c.req.arrayBuffer());
    if (!verified(secret, c.req.header("creem-signature"), raw))
      return c.json({ error: { code: "UNAUTHORIZED", message: "支付回调签名无效" } }, 401);
    const parsed = event.safeParse(json(raw));
    if (!parsed.success)
      return c.json({ error: { code: "VALIDATION_ERROR", message: "支付回调格式无效" } }, 400);
    if (parsed.data.eventType === "checkout.completed") {
      const paid = payment.safeParse(parsed.data.object);
      if (!paid.success) return c.json({ received: true });
      const { id, request_id: orderId, order } = paid.data;
      await repository.confirmBillingOrder({
        id: orderId,
        provider,
        checkoutId: id,
        productId: order.product,
        customerId: order.customer,
        transactionId: order.transaction,
        amount: order.amount,
      });
    }
    if (parsed.data.eventType === "credits.granted") {
      const credits = grant.safeParse(parsed.data.object);
      if (credits.success)
        await repository.refreshBillingAccount(
          provider,
          credits.data.customer_id,
          credits.data.account_id,
        );
    }
    return c.json({ received: true });
  });
  return app;
}
