import { BillingError, type CreditWalletProvider } from "@lycoboai/billing";
import type { ImageScope } from "@lycoboai/contracts";
import type { ImageRuntimeRepository } from "@lycoboai/db";

/** 从当前积分账本查余额和扣费账户，生成流程不需要收银台适配器。 */
export function externalWalletService(
  repository: Pick<ImageRuntimeRepository, "billingCustomer">,
  provider: CreditWalletProvider,
) {
  return {
    provider: provider.id,
    async balance(scope: ImageScope) {
      const customer = await repository.billingCustomer(scope, provider.id);
      return customer ? provider.balance(customer.accountId) : 0;
    },
    async generationAccount(scope: ImageScope, cost: number) {
      const customer = await repository.billingCustomer(scope, provider.id);
      if (!customer || (cost > 0 && (await provider.balance(customer.accountId)) < cost))
        throw new BillingError("INSUFFICIENT_CREDITS");
      return { provider: provider.id, accountId: customer.accountId };
    },
  };
}

export type ExternalWalletService = ReturnType<typeof externalWalletService>;
