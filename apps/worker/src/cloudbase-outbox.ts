import type { ImageRuntimeRepository } from "@lycoboai/db";

// Matches the LIMIT of the leaseOutbox database operation.
const leaseBatchSize = 20;

/**
 * Continue accepted provider reads within the owning Event invocation. `resumeAt` is when work
 * left behind becomes due once this invocation stops starting work, or null when none remains.
 */
export async function drainCloudBaseOutbox({
  repository,
  process,
  stopStartingAt,
  now = Date.now,
  wait = (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
}: {
  repository: Pick<ImageRuntimeRepository, "leaseOutbox" | "ackOutbox">;
  process: (itemId: string, onDeferred: (delayMs: number) => void) => Promise<void>;
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
    let index = 0;
    for (; index < leased.length; index += 2) {
      // Unstarted intents remain durable and become available after their lease expires.
      if (now() >= stopStartingAt) break;
      await Promise.all(
        leased.slice(index, index + 2).map(async (entry) => {
          await process(entry.itemId, onDeferred);
          await repository.ackOutbox(entry.id, entry.leaseToken);
          processed.add(entry.itemId);
        }),
      );
    }
    // Remaining work: unstarted intents once their 30-second lease lapses, deferred provider
    // reads, or a full batch that may have more intents queued behind it.
    const due = Math.min(
      index < leased.length ? now() + 30000 : Number.POSITIVE_INFINITY,
      nextPollAt,
      leased.length === leaseBatchSize ? now() : Number.POSITIVE_INFINITY,
    );
    if (due === Number.POSITIVE_INFINITY) return { processed: processed.size, resumeAt: null };
    resumeAt = due;
    if (due >= stopStartingAt) break;
    await wait(Math.max(0, due - now()));
  }
  return {
    processed: processed.size,
    resumeAt: resumeAt === null ? null : Math.max(resumeAt, now()),
  };
}
