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
  expect(result).toBe(1);
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
  ).toBe(1);
  expect(process).toHaveBeenCalledOnce();
  expect(wait).not.toHaveBeenCalled();
});
it("leaves a deferred intent durable when its next read exceeds the invocation budget", async () => {
  const intent = entry();
  const repository = { leaseOutbox: vi.fn(async () => [intent]), ackOutbox: vi.fn(async () => {}) };
  const wait = vi.fn(async () => {});
  const process = vi.fn(async (_itemId: string, onDeferred: (ms: number) => void) =>
    onDeferred(60000),
  );
  expect(
    await drainCloudBaseOutbox({ repository, process, now: () => 0, wait, stopStartingAt: 20000 }),
  ).toBe(1);
  expect(process).toHaveBeenCalledOnce();
  expect(wait).not.toHaveBeenCalled();
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
