import { expect, it, vi } from "vitest";
import { consumeImageMessages } from "./queue-consumer";

function delivery(body: unknown) {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    body,
    attempts: 1,
    ack: vi.fn(),
    retry: vi.fn(),
  };
}
const batch = (message: ReturnType<typeof delivery>) => ({
  queue: "fixture",
  messages: [message],
  ackAll() {},
  retryAll() {},
});
it("acknowledges a settled ambiguous outcome and never turns it into a transport retry", async () => {
  const message = delivery({ version: 1, itemId: crypto.randomUUID() });
  await consumeImageMessages(batch(message), async () => {
    /* DB has recorded needs_reconciliation. */
  });
  expect(message.ack).toHaveBeenCalledOnce();
  expect(message.retry).not.toHaveBeenCalled();
});
it("keeps failed persistence eligible for redelivery instead of acknowledging it", async () => {
  const message = delivery({ version: 1, itemId: crypto.randomUUID() });
  await consumeImageMessages(batch(message), async () => {
    throw new Error("DB_UNAVAILABLE");
  });
  expect(message.ack).not.toHaveBeenCalled();
  expect(message.retry).toHaveBeenCalledWith({ delaySeconds: 30 });
});
it("discards malformed and content-bearing messages without invoking a paid processor", async () => {
  const process = vi.fn();
  const message = delivery({
    version: 1,
    itemId: crypto.randomUUID(),
    userId: crypto.randomUUID(),
  });
  await consumeImageMessages(batch(message), process);
  expect(process).not.toHaveBeenCalled();
  expect(message.ack).toHaveBeenCalledOnce();
});
