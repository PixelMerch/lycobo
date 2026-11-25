import type { ImageScope } from "@lycoboai/contracts";
import type postgres from "postgres";
import { z } from "zod";
import { WalletError } from "./wallet-repository";

const mapping = z.object({ customerId: z.string(), accountId: z.string() });
const orderRow = z.object({
  id: z.uuid(),
  productId: z.string(),
  customerId: z.string(),
  amount: z.number().int(),
  credits: z.number().int(),
  url: z.string().nullable(),
});
type OrderInput = {
  provider: string;
  productId: string;
  customerId: string;
  amount: number;
  credits: number;
};

/** 保存账户映射和订单，始终用鉴权后的站内身份选择付款账户。 */
export function billingRepository(sql: postgres.Sql) {
  return {
    async billingCustomer(scope: ImageScope, provider: string) {
      const [row] = await sql`select customer_id as "customerId", account_id as "accountId"
        from billing_customers where provider=${provider} and user_id=${scope.userId}
        and exists(select 1 from organization_members where user_id=${scope.userId} and organization_id=${scope.organizationId})`;
      return row ? mapping.parse(row) : null;
    },
    async billingEmail(scope: ImageScope) {
      const [row] = await sql`select email from social_accounts
        where user_id=${scope.userId} and organization_id=${scope.organizationId} and disabled_at is null`;
      return z.email().safeParse(row?.email).data ?? null;
    },
    async saveBillingCustomer(
      scope: ImageScope,
      provider: string,
      customer: z.infer<typeof mapping>,
    ) {
      const [row] =
        await sql`insert into billing_customers (provider,user_id,customer_id,account_id)
        select ${provider},${scope.userId},${customer.customerId},${customer.accountId}
        where exists(select 1 from organization_members where user_id=${scope.userId} and organization_id=${scope.organizationId})
        on conflict (provider,user_id) do update set account_id=billing_customers.account_id
        returning customer_id as "customerId",account_id as "accountId"`;
      const stored = mapping.parse(row);
      if (stored.customerId !== customer.customerId || stored.accountId !== customer.accountId)
        throw new WalletError("STATE_CONFLICT");
      return stored;
    },
    async createBillingOrder(scope: ImageScope, key: string, input: OrderInput) {
      return sql.begin(async (tx) => {
        const [inserted] = await tx`insert into billing_orders
          (organization_id,user_id,idempotency_key,provider,product_id,customer_id,amount_minor,credits)
          select ${scope.organizationId},${scope.userId},${key},${input.provider},${input.productId},${input.customerId},${input.amount},${input.credits}
          where exists(select 1 from organization_members where user_id=${scope.userId} and organization_id=${scope.organizationId})
          on conflict (organization_id,user_id,idempotency_key) do nothing
          returning id`;
        if (inserted) return { id: z.uuid().parse(inserted.id), url: null, fresh: true };
        const [existing] =
          await tx`select id,provider,product_id as "productId",customer_id as "customerId",
          amount_minor as amount,credits,checkout_url as url from billing_orders
          where organization_id=${scope.organizationId} and user_id=${scope.userId} and idempotency_key=${key}`;
        if (!existing) throw new WalletError("FORBIDDEN");
        const order = orderRow.parse(existing);
        if (
          existing?.provider !== input.provider ||
          order.productId !== input.productId ||
          order.customerId !== input.customerId ||
          order.amount !== input.amount ||
          order.credits !== input.credits
        )
          throw new WalletError("IDEMPOTENCY_CONFLICT");
        return { id: order.id, url: order.url, fresh: false };
      });
    },
    async saveBillingCheckout(
      scope: ImageScope,
      orderId: string,
      checkout: { id: string; url: string },
    ) {
      await sql`update billing_orders set checkout_id=${checkout.id},checkout_url=${checkout.url}
        where id=${orderId} and organization_id=${scope.organizationId} and user_id=${scope.userId}
        and (checkout_id is null or checkout_id=${checkout.id})`;
    },
    async confirmBillingOrder(order: {
      id: string;
      provider: string;
      checkoutId: string;
      productId: string;
      customerId: string;
      transactionId: string;
      amount: number;
    }) {
      return sql.begin(async (tx) => {
        // 回调可能早于创建收银台的响应，仍须匹配预存的订单、客户和金额。
        const [changed] =
          await tx`update billing_orders set paid_at=now(),transaction_id=${order.transactionId},
          checkout_id=coalesce(checkout_id,${order.checkoutId})
          where id=${order.id} and provider=${order.provider} and product_id=${order.productId}
          and customer_id=${order.customerId} and amount_minor=${order.amount}
          and (checkout_id is null or checkout_id=${order.checkoutId}) and paid_at is null
          returning organization_id,user_id,credits`;
        if (!changed) return;
        await tx`insert into billing_credit_entries (provider,organization_id,user_id,kind,amount,order_id)
          values (${order.provider},${changed.organization_id},${changed.user_id},'recharge',${changed.credits},${order.id})
          on conflict (order_id) do nothing`;
        await tx`insert into realtime_outbox (channel,user_id,event)
          values (${changed.organization_id},${changed.user_id},jsonb_build_object('id',gen_random_uuid(),'kind','wallet'))`;
      });
    },
    async refreshBillingAccount(provider: string, customerId: string, accountId: string) {
      await sql`insert into realtime_outbox (channel,user_id,event)
        select m.organization_id::text,b.user_id,jsonb_build_object('id',gen_random_uuid(),'kind','wallet')
        from billing_customers b join organization_members m on m.user_id=b.user_id
        where b.provider=${provider} and b.customer_id=${customerId} and b.account_id=${accountId}`;
    },
    async billingEntries(
      scope: ImageScope,
      provider: string,
      limit: number,
      before?: string,
      view?: "spent" | "earned",
    ) {
      const recent = view
        ? sql`and (e.kind='consume')=${view === "spent"} and e.created_at>=now()-interval '6 months'`
        : sql``;
      return sql`select e.id::text,u.uid as user_uid,e.kind,e.amount,null as balance_after,
        j.id as job_id,j.public_id as task_id,e.item_id,e.order_id as recharge_id,e.created_at
        from billing_credit_entries e join users u on u.id=e.user_id
        left join generation_job_items i on i.id=e.item_id left join generation_jobs j on j.id=i.job_id
        where e.provider=${provider} and e.organization_id=${scope.organizationId} and e.user_id=${scope.userId}
        ${recent} ${before ? sql`and e.id<${before}::bigint` : sql``}
        order by e.id desc limit ${limit}`;
    },
    async billingOrders(scope: ImageScope, limit: number, before?: string) {
      return sql`with orders as (
        select r.id,u.uid as user_uid,r.credits,r.amount_minor,'USD' as currency,
          case when r.paid_at is null then 'pending' else 'paid' end as status,
          r.provider as channel,r.created_at,r.paid_at
        from billing_orders r join users u on u.id=r.user_id
        where r.user_id=${scope.userId} and r.organization_id=${scope.organizationId}
        union all
        select r.id,u.uid,r.credits,r.amount_minor,r.currency::text,r.status::text,r.channel,r.created_at,r.paid_at
        from recharge_orders r join organization_wallets w on w.id=r.wallet_id join users u on u.id=r.user_id
        where w.organization_id=${scope.organizationId}
      )
      select * from orders
        ${before ? sql`where (created_at,id)<(select created_at,id from orders where id=${before})` : sql``}
        order by created_at desc,id desc limit ${limit}`;
    },
  };
}
