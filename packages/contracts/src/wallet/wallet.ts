import { z } from "zod";
/** 区分本地积分与用户在线购买的积分流水。 */
export const walletSourceSchema = z.enum(["local", "purchased"]);
export type WalletSource = z.infer<typeof walletSourceSchema>;

export const walletBalanceSchema = z.object({
  balance: z.number().int().nonnegative(),
  unitCredits: z.number().int().positive(),
  purchasedBalance: z.number().int().nonnegative().nullable().optional(),
});
const walletEntrySchema = z.object({
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
});
export const walletEntriesSchema = z.object({
  data: z.array(walletEntrySchema),
});
/** 合并站内和购买流水，结余仍以账户当前总额为准。 */
export const walletHistorySchema = z.object({
  data: z.array(walletEntrySchema.omit({ balance_after: true }).extend({ id: z.string() })),
  nextCursor: z.string().nullable(),
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
