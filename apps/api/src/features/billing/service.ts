import { BillingError, type PaymentProvider } from "@lycoboai/billing";
import {
  checkoutPackSchema,
  creditOfferEnd,
  creditPacks,
  type ImageScope,
  pricedCreditPack,
} from "@lycoboai/contracts";
import type { ImageRuntimeRepository } from "@lycoboai/db";
import { z } from "zod";

type BillingRepository = Pick<
  ImageRuntimeRepository,
  | "billingCustomer"
  | "billingEmail"
  | "saveBillingCustomer"
  | "createBillingOrder"
  | "saveBillingCheckout"
>;

function readProducts(config: string | undefined): Record<string, string | undefined> {
  if (!config) return {};
  return z
    .partialRecord(checkoutPackSchema, z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/))
    .parse(JSON.parse(config));
}

/** 关联已登录的买家并创建托管收银台，商品、单价和到账积分由服务端目录确定。 */
export function checkoutService(
  repository: BillingRepository,
  provider: PaymentProvider,
  config: { products?: string | undefined; offerEnd?: string | undefined; successUrl: string },
) {
  const products = readProducts(config.products);
  const offerEnd = creditOfferEnd(config.offerEnd);
  const available = () => {
    const includeOffer = Date.now() < Date.parse(offerEnd);
    return creditPacks
      .map((pack) => ({
        ...pricedCreditPack(pack, includeOffer),
        // 正式收银台只交付购买积分，站内赠送额度随订单保存。
        credits: pack.credits,
        bonusCredits: includeOffer ? pack.bonusCredits : 0,
      }))
      .flatMap((pack) => {
        const productId = products[pack.key];
        return productId ? [{ ...pack, productId }] : [];
      });
  };
  async function resolveCustomer(scope: ImageScope, email: string) {
    const existing = await repository.billingCustomer(scope, provider.id);
    if (existing) return existing;
    const customer = await provider.customer({ userId: scope.userId, email });
    return repository.saveBillingCustomer(scope, provider.id, customer);
  }
  return {
    offerEnd,
    async options(scope: ImageScope) {
      const eligible = await repository.billingEmail(scope);
      return { packs: eligible ? available().map((pack) => pack.key) : [], offerEnd };
    },
    async checkout(scope: ImageScope, key: string, packKey: string) {
      const pack = available().find(({ key }) => key === packKey);
      if (!pack) throw new BillingError("BILLING_UNAVAILABLE");
      // 已有渠道客户记录也要重新校验当前工作区的充值资格。
      const email = await repository.billingEmail(scope);
      if (!email) throw new BillingError("BILLING_UNAVAILABLE");
      const customer = await resolveCustomer(scope, email);
      const order = await repository.createBillingOrder(scope, key, {
        ...pack,
        provider: provider.id,
        customerId: customer.customerId,
      });
      if (order.url) return { url: order.url };
      // Creem 的 request_id 用于关联订单。回执丢失时保留原订单，避免以同一单号新建收银台。
      if (!order.fresh) throw new BillingError("BILLING_UNAVAILABLE");
      const checkout = await provider.checkout({
        ...pack,
        orderId: order.id,
        customerId: customer.customerId,
        successUrl: config.successUrl,
      });
      await repository.saveBillingCheckout(scope, order.id, checkout);
      return { url: checkout.url };
    },
  };
}
export type CheckoutService = ReturnType<typeof checkoutService>;
