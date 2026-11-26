import { z } from "zod";
export const walletBalanceSchema = z.object({
  balance: z.number().int().nonnegative(),
  unitCredits: z.number().int().positive(),
});
export const walletEntriesSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().regex(/^[0-9]+$/),
      user_uid: z.string().nullable(),
      kind: z.enum(["opening", "consume", "refund", "recharge", "checkin"]),
      amount: z.number().int(),
      balance_after: z.number().int().nonnegative().nullable(),
      job_id: z.uuid().nullable(),
      task_id: z.string().nullable(),
      item_id: z.uuid().nullable(),
      recharge_id: z.uuid().nullable(),
      created_at: z.string(),
    }),
  ),
});
export const rechargeOrdersSchema = z.object({
  data: z.array(
    z.object({
      id: z.uuid(),
      user_uid: z.string(),
      credits: z.number().int().positive(),
      amount_minor: z.number().int().positive(),
      currency: z.enum(["CNY", "USD"]),
      status: z.enum(["pending", "paid", "closed"]),
      channel: z.string(),
      created_at: z.string(),
      paid_at: z.string().nullable(),
    }),
  ),
});
