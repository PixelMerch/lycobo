import { expect, it, vi } from "vitest";
import { drainCloudBaseOutbox } from "./cloudbase-outbox";

const entry = () => ({
  id: crypto.randomUUID(),
  itemId: crypto.randomUUID(),
  leaseToken: crypto.randomUUID(),
});
it("retrieves an accepted result in the same invocation without another paid submission", async () => {
  const intent = entry();
  let phase: "queued" | "polling" | "complete" = "queued";
  let time = 0,
    submissions = 0,
    reads = 0;
  const wait = vi.fn(async (ms: number) => {
    time += ms;
  });
  const repository = {
    leaseOutbox: vi.fn(async () => (phase === "complete" ? [] : [intent])),
    ackOutbox: vi.fn(async () => {}),
  };
  const result = await drainCloudBaseOutbox({
    repository,
    now: () => time,
    wait,
    stopStartingAt: 20000,
    process: async (itemId, onDeferred) => {
      expect(itemId).toBe(intent.itemId);
      if (phase === "queued") {
        submissions++;
        phase = "polling";
        onDeferred(3000);
      } else {
        reads++;
        phase = "complete";
      }
    },
  });
  expect(result).toEqual({ processed: 1, resumeAt: null });
  expect(submissions).toBe(1);
  expect(reads).toBe(1);
  expect(wait).toHaveBeenCalledExactlyOnceWith(3000);
  expect(phase).toBe("complete");
});
it("does not retry an unresolved outcome or idle after completed work", async () => {
  const repository = {
    leaseOutbox: vi.fn(async () => [entry()]),
    ackOutbox: vi.fn(async () => {}),
  };
  const process = vi.fn(async () => {}),
    wait = vi.fn(async () => {});
  expect(
    await drainCloudBaseOutbox({ repository, process, now: () => 0, wait, stopStartingAt: 20000 }),
  ).toEqual({ processed: 1, resumeAt: null });
  expect(process).toHaveBeenCalledOnce();
  expect(wait).not.toHaveBeenCalled();
});
it.each([false, true])(
  "releases a persisted webhook submission with an early callback = %s",
  async (early) => {
    const intent = entry();
    const repository = {
      leaseOutbox: vi.fn(async () => [intent]),
      ackOutbox: vi.fn(async () => {}),
    };
    const wait = vi.fn(async () => {});
    const result = await drainCloudBaseOutbox({
      repository,
      now: () => 1000,
      stopStartingAt: 20000,
      wait,
      process: async (_itemId, _onDeferred, onWebhookAccepted) => onWebhookAccepted(early),
    });
    expect(result).toEqual({ processed: 1, resumeAt: early ? 1000 : null });
    expect(repository.leaseOutbox).toHaveBeenCalledOnce();
    expect(repository.ackOutbox).toHaveBeenCalledExactlyOnceWith(intent.id, intent.leaseToken);
    expect(wait).not.toHaveBeenCalled();
  },
);
it("leaves a deferred intent durable when its next read exceeds the invocation budget", async () => {
  const intent = entry();
  const repository = { leaseOutbox: vi.fn(async () => [intent]), ackOutbox: vi.fn(async () => {}) };
  const wait = vi.fn(async () => {});
  const process = vi.fn(async (_itemId: string, onDeferred: (ms: number) => void) =>
    onDeferred(60000),
  );
  // The next read is reported so the consumer can continue it instead of waiting for the timer.
  expect(
    await drainCloudBaseOutbox({ repository, process, now: () => 0, wait, stopStartingAt: 20000 }),
  ).toEqual({ processed: 1, resumeAt: 60000 });
  expect(process).toHaveBeenCalledOnce();
  expect(wait).not.toHaveBeenCalled();
});
it("keeps draining full batches and reports intents left unstarted at the budget", async () => {
  let time = 0;
  const batches = [Array.from({ length: 20 }, entry), Array.from({ length: 20 }, entry), []];
  const repository = {
    leaseOutbox: vi.fn(async () => batches.shift() ?? []),
    ackOutbox: vi.fn(async () => {}),
  };
  const wait = vi.fn(async () => {});
  expect(
    await drainCloudBaseOutbox({
      repository,
      process: async () => {},
      now: () => time,
      wait,
      stopStartingAt: 20000,
    }),
  ).toEqual({ processed: 40, resumeAt: null });
  expect(repository.leaseOutbox).toHaveBeenCalledTimes(3);
  const slow = [Array.from({ length: 4 }, entry)];
  const stopped = await drainCloudBaseOutbox({
    repository: { leaseOutbox: async () => slow.shift() ?? [], ackOutbox: async () => {} },
    process: async () => {
      time = 25000;
    },
    now: () => time,
    wait,
    stopStartingAt: 20000,
  });
  // The first item used up the budget; the other three never started and become available again
  // once their lease lapses.
  expect(stopped).toEqual({ processed: 1, resumeAt: 55000 });
});
it("starts no new paid work after a failure but lets in-flight items finish", async () => {
  const entries = Array.from({ length: 6 }, entry);
  const repository = {
    leaseOutbox: vi.fn(async () => entries),
    ackOutbox: vi.fn(async (_id: string, _leaseToken: string) => {}),
  };
  const process = vi.fn(async (itemId: string) => {
    await Promise.resolve();
    if (itemId === entries[0]?.itemId) throw new Error("DATABASE_UNAVAILABLE");
  });
  await expect(
    drainCloudBaseOutbox({ repository, process, now: () => 0, stopStartingAt: 20000 }),
  ).rejects.toThrow("DATABASE_UNAVAILABLE");
  // The second item was in flight when the first failed: it finishes and is acknowledged, and
  // its slot starts nothing new.
  expect(process).toHaveBeenCalledTimes(2);
  expect(repository.ackOutbox.mock.calls.map(([id]) => id)).toEqual([entries[1]?.id]);
});
it("keeps at most two task operations in flight", async () => {
  let active = 0,
    maximum = 0;
  const repository = {
    leaseOutbox: async () => Array.from({ length: 5 }, entry),
    ackOutbox: async () => {},
  };
  await drainCloudBaseOutbox({
    repository,
    now: () => 0,
    stopStartingAt: 20000,
    process: async () => {
      active++;
      maximum = Math.max(maximum, active);
      await Promise.resolve();
      active--;
    },
  });
  expect(maximum).toBe(2);
});
