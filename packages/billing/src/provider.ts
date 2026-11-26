/** 在任务事务中保存外部扣费凭据，生成代码只依赖通用字段。 */
export type CreditAuthorization = {
  provider: string;
  accountId: string;
  approvals: ReadonlyMap<number, string>;
};

/** 对外错误只携带稳定错误码，不暴露支付响应或密钥。 */
export class BillingError extends Error {
  constructor(
    readonly code: "BILLING_UNAVAILABLE" | "INSUFFICIENT_CREDITS" | "CREDIT_APPROVAL_INVALID",
  ) {
    super(code);
  }
}

export type PaymentProvider = {
  id: string;
  customer(input: { userId: string; email: string }): Promise<{
    customerId: string;
    accountId: string;
  }>;
  checkout(input: {
    productId: string;
    customerId: string;
    orderId: string;
    successUrl: string;
    amount: number;
    credits: number;
  }): Promise<{ id: string; url: string }>;
};

export type CreditWalletProvider = {
  id: string;
  balance(accountId: string): Promise<number>;
  debit(input: {
    itemId: string;
    accountId: string;
    approval: string;
    amount: number;
  }): Promise<string>;
  reverse(accountId: string, transactionId: string): Promise<void>;
};

export type BillingProvider = PaymentProvider & CreditWalletProvider;
