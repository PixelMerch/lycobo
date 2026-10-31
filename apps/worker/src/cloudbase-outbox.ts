import type { ImageRuntimeRepository } from "@lycoboai/db";

/** Continue accepted provider reads within the owning Event invocation. */
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
  while (now() < stopStartingAt) {
    const leased = await repository.leaseOutbox();
    if (!leased.length) break;
    let nextPollAt = Number.POSITIVE_INFINITY;
    const onDeferred = (delayMs: number) => {
      nextPollAt = Math.min(nextPollAt, now() + Math.max(2000, Math.min(delayMs, 60000)));
    };
    for (let index = 0; index < leased.length; index += 2) {
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
    if (nextPollAt >= stopStartingAt) break;
    await wait(Math.max(0, nextPollAt - now()));
  }
  return processed.size;
}
