import { expect, it, vi } from "vitest";
import { dispatchRealtime } from "./realtime";

it("keeps failed publication pending and retries the same identity before acknowledging", async () => {
  const event = { id: crypto.randomUUID(), kind: "wallet" as const };
  const row = { id: crypto.randomUUID(), channel: crypto.randomUUID(), userId: null, event };
  const repository = {
    pending: async () => [row],
    sessions: vi.fn(async () => ["session"]),
    delivered: vi.fn(async () => undefined),
  };
  const publish = vi
    .fn(async () => undefined)
    .mockRejectedValueOnce(new Error("TRANSPORT_UNAVAILABLE"));
  const getByName = vi.fn(() => ({ publish }));
  await expect(dispatchRealtime(repository, { getByName })).rejects.toThrow(
    "TRANSPORT_UNAVAILABLE",
  );
  expect(repository.delivered).not.toHaveBeenCalled();
  await dispatchRealtime(repository, { getByName });
  expect(publish).toHaveBeenCalledTimes(2);
  expect(publish).toHaveBeenLastCalledWith(row.id, event, null, ["session"]);
  expect(repository.delivered).toHaveBeenCalledExactlyOnceWith(row.id);
  expect(getByName).toHaveBeenCalledWith(row.channel);
});
it("never queries or routes private sessions for public release events", async () => {
  const row = {
    id: crypto.randomUUID(),
    channel: "public",
    userId: null,
    event: { id: crypto.randomUUID(), kind: "release" as const },
  };
  const repository = {
    pending: async () => [row],
    sessions: vi.fn(async () => []),
    delivered: vi.fn(async () => undefined),
  };
  const publish = vi.fn(async () => undefined);
  await dispatchRealtime(repository, { getByName: () => ({ publish }) });
  expect(repository.sessions).not.toHaveBeenCalled();
  expect(publish).toHaveBeenCalledWith(row.id, row.event, null, []);
});
