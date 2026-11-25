import { BillingError, type CreditWalletProvider } from "./provider";

type Charge = {
  itemId: string;
  jobId: string;
  accountId: string;
  approval: string;
  amount: number;
  state: "debit" | "reverse";
  transactionId: string | null;
  token: string;
};
type Result = { transactionId: string } | { declined: string } | { reversed: true };

async function settle(provider: CreditWalletProvider, work: Charge): Promise<Result> {
  if (work.state === "reverse" && work.transactionId) {
    await provider.reverse(work.accountId, work.transactionId);
    return { reversed: true };
  }
  if (work.state !== "debit") throw new Error("BILLING_CHARGE_STATE");
  try {
    return { transactionId: await provider.debit(work) };
  } catch (error) {
    if (error instanceof BillingError && error.code !== "BILLING_UNAVAILABLE")
      return { declined: error.code };
    throw error;
  }
}

type SettlementRepository<T extends Charge> = {
  leaseGenerationCharges(providerId: string, jobId?: string): Promise<T[]>;
  finishGenerationCharge(work: T, result: Result): Promise<void>;
};

/** 从独立账务意图处理扣费和冲正。无法确认时保留原操作，待租约到期后以原幂等键核对。 */
export async function settleGenerationCredits<T extends Charge>(
  provider: CreditWalletProvider,
  repository: SettlementRepository<T>,
  jobId?: string,
) {
  const work = await repository.leaseGenerationCharges(provider.id, jobId);
  const results = await Promise.allSettled(
    work.map(async (item) => repository.finishGenerationCharge(item, await settle(provider, item))),
  );
  return {
    attempted: work.length,
    deferred: results.filter((result) => result.status === "rejected").length,
  };
}

/** 限制单次处理批数，剩余扣费交回独立消费者恢复。 */
export async function drainGenerationCredits<T extends Charge>(
  provider: CreditWalletProvider,
  repository: SettlementRepository<T>,
  jobId?: string,
) {
  let deferred = 0;
  for (let pass = 0; pass < 5; pass++) {
    const result = await settleGenerationCredits(provider, repository, jobId);
    deferred += result.deferred;
    if (result.attempted === 0) break;
  }
  return deferred;
}
