import type { ImageRuntimeRepository } from "@lycoboai/db";

// Matches the LIMIT of the leaseOutbox database operation.
const leaseBatchSize = 20;
// With async providers an item holds a slot only while it submits or reads its result (about
// 10 s); generation overlaps across items as deferred reads. Four slots saved about 12 s per
// 5-image batch in production but raised peak memory from 278 to 381 MB of 512 MB at 1.5K, a
// margin 4K batches would lose.
const itemConcurrency = 2;

function remainingOutboxDue(now: number, leased: number, started: number) {
  // Unstarted intents become available when their lease expires. A full batch can
  // have more intents queued behind it.
  if (started < leased) return now + 30000;
  return leased === leaseBatchSize ? now : Number.POSITIVE_INFINITY;
}

/**
 * Continue accepted provider reads within the owning Event invocation. `resumeAt` is when work
 * left behind becomes due once this invocation stops starting work, or null when none remains.
 */
export async function drainImageOutbox({
  repository,
  process,
  stopStartingAt,
  now = Date.now,
  wait = (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
}: {
  repository: Pick<ImageRuntimeRepository, "leaseOutbox" | "ackOutbox">;
  process: (
    itemId: string,
    onDeferred: (delayMs: number) => void,
    onWebhookAccepted: (ready: boolean) => void,
  ) => Promise<void>;
  stopStartingAt: number;
  now?: () => number;
  wait?: (ms: number) => Promise<void>;
}) {
  const processed = new Set<string>();
  let resumeAt: number | null = null;
  while (now() < stopStartingAt) {
    const leased = await repository.leaseOutbox();
    if (!leased.length) return { processed: processed.size, resumeAt: null };
    let nextPollAt = Number.POSITIVE_INFINITY;
    const onDeferred = (delayMs: number) => {
      nextPollAt = Math.min(nextPollAt, now() + Math.max(2000, Math.min(delayMs, 60000)));
    };
    let webhookAccepted = false;
    const onWebhookAccepted = (ready: boolean) => {
      webhookAccepted = true;
      if (ready) nextPollAt = Math.min(nextPollAt, now());
    };
    let started = 0;
    let failure: { error: unknown } | undefined;
    const worker = async () => {
      // Unstarted intents remain durable and become available after their lease expires.
      // After a failure, in-flight items finish but no new paid work starts.
      while (!failure && started < leased.length && now() < stopStartingAt) {
        const entry = leased[started++];
        if (!entry) break;
        try {
          await process(entry.itemId, onDeferred, onWebhookAccepted);
          await repository.ackOutbox(entry.id, entry.leaseToken);
          processed.add(entry.itemId);
        } catch (error) {
          failure ??= { error };
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(itemConcurrency, leased.length) }, worker));
    if (failure) throw failure.error;
    const due = Math.min(remainingOutboxDue(now(), leased.length, started), nextPollAt);
    if (due === Number.POSITIVE_INFINITY) return { processed: processed.size, resumeAt: null };
    resumeAt = due;
    // Finish writing all receipts in the current batch. A ready callback gets a fresh
    // invocation, and a pending callback leaves this invocation with no provider wait.
    if (webhookAccepted || due >= stopStartingAt) break;
    const remaining = due - now();
    if (remaining > 0) await wait(remaining);
  }
  return {
    processed: processed.size,
    resumeAt: resumeAt === null ? null : Math.max(resumeAt, now()),
  };
}
