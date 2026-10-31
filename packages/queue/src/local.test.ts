import { afterEach, expect, it, vi } from "vitest";
import { dispatchImageOutbox } from "./index";
import { localQueueSender } from "./local";

afterEach(() => vi.unstubAllGlobals());

it("leaves the durable outbox unacknowledged when the Redis bridge rejects delivery", async () => {
  const itemId = crypto.randomUUID();
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
  vi.stubGlobal("fetch", fetch);
  const ackOutbox = vi.fn();
  await expect(
    dispatchImageOutbox(
      {
        leaseOutbox: async () => [{ id: "outbox", itemId, leaseToken: "lease" }],
        ackOutbox,
      },
      localQueueSender({ LOCAL_QUEUE_TOKEN: "local-test-token" }),
    ),
  ).rejects.toThrow("LOCAL_REDIS_QUEUE_UNAVAILABLE");
  expect(ackOutbox).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledWith(
    "http://127.0.0.1:8790/enqueue",
    expect.objectContaining({
      headers: { Authorization: "Bearer local-test-token", "Content-Type": "application/json" },
      body: JSON.stringify({ version: 1, itemId }),
    }),
  );
});
