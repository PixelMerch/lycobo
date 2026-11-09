import type { ImageScope } from "@lycoboai/contracts";
import type postgres from "postgres";
import { z } from "zod";

export class WalletError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
export async function ensureWallet(tx: postgres.TransactionSql, scope: ImageScope) {
  const members =
    await tx`select user_id from organization_members where organization_id=${scope.organizationId} and user_id=${scope.userId} for share`;
  if (!members.length) throw new WalletError("FORBIDDEN");
  await tx`insert into organization_wallets (organization_id)
    values (${scope.organizationId}) on conflict (organization_id) do nothing`;
  const [wallet] = await tx`select id,balance from organization_wallets
    where organization_id=${scope.organizationId} for update`;
  return z.object({ id: z.uuid(), balance: z.number().int().nonnegative() }).parse(wallet);
}
// Caller holds the wallet row lock. Balance and append-only entry commit together.
export async function appendWalletEntry(
  tx: postgres.TransactionSql,
  walletId: string,
  entry: {
    eventKey: string;
    kind: "opening" | "consume" | "refund" | "recharge";
    amount: number;
    userId: string;
    jobId?: string;
    itemId?: string;
    rechargeId?: string;
  },
) {
  const [prior] =
    await tx`select id from wallet_entries where wallet_id=${walletId} and event_key=${entry.eventKey}`;
  if (prior) return false;
  const [balance] =
    await tx`update organization_wallets set balance=balance+${entry.amount},updated_at=now()
    where id=${walletId} and balance+${entry.amount}>=0 returning balance`;
  if (!balance) throw new WalletError("INSUFFICIENT_CREDITS");
  await tx`insert into wallet_entries (wallet_id,event_key,kind,amount,balance_after,user_id,job_id,item_id,recharge_id)
    values (${walletId},${entry.eventKey},${entry.kind},${entry.amount},${balance.balance},${entry.userId},${entry.jobId ?? null},${entry.itemId ?? null},${entry.rechargeId ?? null})`;
  return true;
}
function checkRechargeOrder(
  order: postgres.Row | undefined,
  input: { amountMinor: number; currency: string; channel: string },
) {
  if (
    !order ||
    order.amount_minor !== input.amountMinor ||
    order.currency !== input.currency ||
    order.channel !== input.channel
  )
    throw new WalletError("STATE_CONFLICT");
  return order;
}

export function walletRepository(sql: postgres.Sql) {
  return {
    async wallet(scope: ImageScope) {
      const [row] =
        await sql`select balance from organization_wallets where organization_id=${scope.organizationId}`;
      return {
        balance: z
          .number()
          .int()
          .nonnegative()
          .parse(row?.balance ?? 0),
      };
    },
    async walletEntries(scope: ImageScope, limit: number, before?: string) {
      return sql`select e.id::text,u.uid as user_uid,e.kind,e.amount,e.balance_after,e.job_id,j.public_id as task_id,e.item_id,e.recharge_id,e.created_at
        from wallet_entries e join organization_wallets w on w.id=e.wallet_id left join generation_jobs j on j.id=e.job_id left join users u on u.id=e.user_id
        where w.organization_id=${scope.organizationId}
        ${before ? sql`and e.id < ${before}::bigint` : sql``} order by e.id desc limit ${limit}`;
    },
    async rechargeOrders(scope: ImageScope, limit: number, before?: string) {
      return sql`select r.id,u.uid as user_uid,r.credits,r.amount_minor,r.currency,r.status,r.channel,r.created_at,r.paid_at
        from recharge_orders r join organization_wallets w on w.id=r.wallet_id join users u on u.id=r.user_id
        where w.organization_id=${scope.organizationId}
        ${before ? sql`and (r.created_at,r.id)<(select created_at,id from recharge_orders where id=${before} and wallet_id=w.id)` : sql``}
        order by r.created_at desc,r.id desc limit ${limit}`;
    },
    // Internal payment adapter only. Never expose credit amounts or settlement to browser callers.
    async createRecharge(scope: ImageScope, raw: unknown) {
      const input = z
        .strictObject({
          key: z.uuid(),
          credits: z.number().int().min(1).max(10000000),
          amountMinor: z.number().int().min(1).max(100000000),
          channel: z.string().regex(/^[a-z0-9_-]{1,40}$/),
        })
        .parse(raw);
      return sql.begin(async (tx) => {
        const wallet = await ensureWallet(tx, scope);
        const [order] =
          await tx`insert into recharge_orders (wallet_id,user_id,idempotency_key,credits,amount_minor,channel)
          values (${wallet.id},${scope.userId},${input.key},${input.credits},${input.amountMinor},${input.channel})
          on conflict (wallet_id,idempotency_key) do nothing returning id`;
        if (order) return { id: String(order.id), replayed: false };
        const [existing] =
          await tx`select * from recharge_orders where wallet_id=${wallet.id} and idempotency_key=${input.key}`;
        if (
          !existing ||
          existing.credits !== input.credits ||
          existing.amount_minor !== input.amountMinor ||
          existing.channel !== input.channel
        )
          throw new WalletError("IDEMPOTENCY_CONFLICT");
        return { id: String(existing.id), replayed: true };
      });
    },
    // Payment signature/merchant verification must happen in a future trusted adapter before this call.
    async settleRecharge(raw: unknown) {
      const input = z
        .strictObject({
          id: z.uuid(),
          transactionId: z.string().min(1).max(200),
          channel: z.string().min(1).max(40),
          amountMinor: z.number().int().positive(),
          currency: z.literal("CNY"),
        })
        .parse(raw);
      return sql.begin(async (tx) => {
        const [candidate] =
          await tx`select w.organization_id,r.user_id from recharge_orders r join organization_wallets w on w.id=r.wallet_id where r.id=${input.id}`;
        if (!candidate) throw new WalletError("NOT_FOUND");
        const wallet = await ensureWallet(tx, {
          organizationId: String(candidate.organization_id),
          userId: String(candidate.user_id),
        });
        const [order] = await tx`select * from recharge_orders where id=${input.id} for update`;
        const orderForSettlement = checkRechargeOrder(order, input);
        if (orderForSettlement.status === "paid") {
          if (orderForSettlement.provider_transaction_id !== input.transactionId)
            throw new WalletError("STATE_CONFLICT");
          return { replayed: true };
        }
        if (orderForSettlement.status !== "pending") throw new WalletError("STATE_CONFLICT");
        await tx`update recharge_orders set status='paid',provider_transaction_id=${input.transactionId},paid_at=now() where id=${input.id}`;
        await appendWalletEntry(tx, wallet.id, {
          eventKey: `recharge:${input.id}`,
          kind: "recharge",
          amount: Number(orderForSettlement.credits),
          userId: String(candidate.user_id),
          rechargeId: input.id,
        });
        return { replayed: false };
      });
    },
  };
}
