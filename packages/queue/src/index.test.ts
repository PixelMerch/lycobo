import { describe, expect, it, vi } from "vitest";
import { dispatchImageOutbox, imageQueueJobSchema } from "./index";

const event = () => ({
  id: crypto.randomUUID(),
  itemId: crypto.randomUUID(),
  leaseToken: crypto.randomUUID(),
});
describe("durable outbox transport", () => {
  it("never acknowledges a failed send, so the database lease can recover it", async () => {
    const row = event();
    const repository = { leaseOutbox: async () => [row], ackOutbox: vi.fn() };
    await expect(
      dispatchImageOutbox(repository, {
        send: async () => {
          throw new Error("QUEUE_UNAVAILABLE");
        },
      }),
    ).rejects.toThrow();
    expect(repository.ackOutbox).not.toHaveBeenCalled();
  });
  it("sends only a versioned item ID before acknowledging its exact lease", async () => {
    const row = event();
    const order: string[] = [];
    const send = vi.fn(async () => {
      order.push("send");
    });
    const ackOutbox = vi.fn(async () => {
      order.push("ack");
    });
    await dispatchImageOutbox({ leaseOutbox: async () => [row], ackOutbox }, { send });
    expect(send).toHaveBeenCalledWith({ version: 1, itemId: row.itemId });
    expect(ackOutbox).toHaveBeenCalledWith(row.id, row.leaseToken);
    expect(order).toEqual(["send", "ack"]);
  });
  it("does not hide a post-send database failure and rejects injected task content", async () => {
    const row = event();
    const send = vi.fn(async () => {});
    await expect(
      dispatchImageOutbox(
        {
          leaseOutbox: async () => [row],
          ackOutbox: async () => {
            throw new Error("DB_UNAVAILABLE");
          },
        },
        { send },
      ),
    ).rejects.toThrow();
    expect(send).toHaveBeenCalledOnce();
    expect(
      imageQueueJobSchema.safeParse({ version: 1, itemId: row.itemId, prompt: "untrusted" })
        .success,
    ).toBe(false);
  });
});
