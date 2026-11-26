import { z } from "zod";
import { BillingError, type BillingProvider } from "./provider";

const providerId = z.string().regex(/^[a-z]+_[a-zA-Z0-9]{1,100}$/);
const creditCount = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().nonnegative());
const account = z.object({
  id: providerId,
  customer_id: providerId,
  name: z.string(),
  status: z.string(),
});
const customer = z.object({ id: providerId, external_id: z.string().nullable().optional() });
const transaction = z.object({
  id: providerId,
  reversal_of: providerId.nullable(),
  entries: z.array(
    z.object({
      account_id: providerId,
      side: z.enum(["debit", "credit"]),
      amount: creditCount,
    }),
  ),
  idempotency_key: z.string().optional(),
});
const checkoutResult = z.object({
  id: providerId,
  checkout_url: z.url({ protocol: /^https$/ }).refine((url) => {
    const host = new URL(url).hostname;
    return host === "creem.io" || host.endsWith(".creem.io");
  }),
});
const product = z.object({
  price: z.number().int(),
  currency: z.literal("USD"),
  billing_type: z.literal("onetime"),
  status: z.literal("active"),
  features: z.array(
    z.object({
      type: z.string(),
      customer_credits: z
        .object({ amount: creditCount, requires_moderation: z.boolean() })
        .nullish(),
    }),
  ),
});
const accountPath = (id: string) => `/customer-credits/accounts/${providerId.parse(id)}`;

async function readPayload(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });
  let data = "";
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return JSON.parse(data + text.decode());
      size += value.byteLength;
      if (size > 131072) throw new BillingError("BILLING_UNAVAILABLE");
      data += text.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel();
  }
}

const errorBody = z.object({
  code: z.string().optional(),
  error: z.object({ code: z.string().optional() }).optional(),
});
function responseFailure(status: number, payload: unknown) {
  const parsed = errorBody.safeParse(payload);
  const code = parsed.data?.error?.code ?? parsed.data?.code;
  if (status >= 400 && status < 500) {
    if (code === "insufficient_balance") return new BillingError("INSUFFICIENT_CREDITS");
    if (code?.startsWith("moderation_") && code !== "moderation_already_used")
      return new BillingError("CREDIT_APPROVAL_INVALID");
  }
  return new BillingError("BILLING_UNAVAILABLE");
}

function creemRequest(origin: string, apiKey: string, request: typeof fetch) {
  return async <T>(path: string, schema: z.ZodType<T>, body?: object) => {
    try {
      const response = await request(`${origin}/v1${path}`, {
        method: body ? "POST" : "GET",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
      });
      const payload = await readPayload(response);
      if (!response.ok) throw responseFailure(response.status, payload);
      return schema.parse(payload);
    } catch (error) {
      if (error instanceof BillingError) throw error;
      throw new BillingError("BILLING_UNAVAILABLE");
    }
  };
}

/** 实现 Creem 收银台与钱包协议，固定环境域名并限制请求时间与响应体。 */
export function creemBillingProvider(
  apiKey: string,
  request: typeof fetch = fetch,
): BillingProvider {
  const testMode = apiKey.startsWith("creem_test_");
  const origin = testMode ? "https://test-api.creem.io" : "https://api.creem.io";
  const call = creemRequest(origin, apiKey, request);

  const findAccount = async (customerId: string) => {
    const result = await call(
      `/customer-credits/accounts?customer_id=${encodeURIComponent(customerId)}`,
      z.object({ data: z.array(account) }),
    );
    return result.data.find(
      (entry) => entry.name === "generation" && entry.customer_id === customerId,
    );
  };

  async function getCustomer(userId: string, email: string) {
    const path = `/customers?email=${encodeURIComponent(email)}`;
    const lookup = () => call(path, customer).catch(() => null);
    const existing = await lookup();
    const created =
      existing ??
      (await call("/customers", customer, { email, external_id: userId }).catch(lookup));
    // 邮箱只用于查找，绑定必须由 Creem 回传的站内标识确认。
    if (!created || created.external_id !== userId) throw new BillingError("BILLING_UNAVAILABLE");
    return created.id;
  }

  return {
    id: testMode ? "creem-test" : "creem",
    async customer({ userId, email }) {
      const customerId = await getCustomer(userId, email);
      const existing = await findAccount(customerId);
      const wallet =
        existing ??
        (await call("/customer-credits/accounts", account, {
          customer_id: customerId,
          name: "generation",
          unit_label: "credits",
        }).catch(() => findAccount(customerId)));
      if (
        wallet?.status !== "active" ||
        wallet.customer_id !== customerId ||
        wallet.name !== "generation"
      )
        throw new BillingError("BILLING_UNAVAILABLE");
      return { customerId, accountId: wallet.id };
    },
    async balance(accountId) {
      const data = await call(
        `${accountPath(accountId)}/balance`,
        z.object({ balance: creditCount }),
      );
      return data.balance;
    },
    async checkout(input) {
      const detail = await call(
        `/products?product_id=${providerId.parse(input.productId)}`,
        product,
      );
      if (
        detail.price !== input.amount ||
        !detail.features.some(
          (feature) =>
            feature.type === "customerCredits" &&
            feature.customer_credits?.requires_moderation &&
            feature.customer_credits.amount === input.credits,
        )
      )
        throw new BillingError("BILLING_UNAVAILABLE");
      const result = await call("/checkouts", checkoutResult, {
        product_id: input.productId,
        customer: { id: input.customerId },
        request_id: input.orderId,
        metadata: { referenceId: input.orderId },
        success_url: input.successUrl,
      });
      return { id: result.id, url: result.checkout_url };
    },
    async debit({ itemId, accountId, approval, amount }) {
      const reference = `image:${itemId}`;
      const idempotencyKey = `debit_${itemId}`;
      const matches = (value: z.infer<typeof transaction>) =>
        value.reversal_of === null &&
        value.entries.some(
          (entry) =>
            entry.side === "debit" && entry.account_id === accountId && entry.amount === amount,
        );
      // 余额或审核类结果也可能来自一次丢失回执后的重试，先核对原交易。
      const result = await call(`${accountPath(accountId)}/debit`, transaction, {
        amount: String(amount),
        reference,
        idempotency_key: idempotencyKey,
        moderation_id: approval,
      }).catch(async (error: unknown) => {
        const found = await call(
          `/customer-credits/transactions?reference=${encodeURIComponent(reference)}`,
          z.object({ data: z.array(transaction) }),
        );
        const prior = found.data.find(
          (value) => value.idempotency_key === idempotencyKey && matches(value),
        );
        if (!prior) throw error;
        return prior;
      });
      if (!matches(result)) throw new BillingError("BILLING_UNAVAILABLE");
      return result.id;
    },
    async reverse(accountId, transactionId) {
      const result = await call(`${accountPath(accountId)}/reverse`, transaction, {
        transaction_id: providerId.parse(transactionId),
      });
      if (result.reversal_of !== transactionId) throw new BillingError("BILLING_UNAVAILABLE");
    },
  };
}
