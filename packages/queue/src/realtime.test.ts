import { expect, it, vi } from "vitest";
import { dispatchRealtime } from "./realtime";

it("delivers an exact session revocation without reading the workspace session list", async () => {
  const row = {
    id: crypto.randomUUID(),
    channel: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    event: {
      id: crypto.randomUUID(),
      kind: "session-revoked" as const,
      resourceId: crypto.randomUUID(),
    },
  };
  const publish = vi.fn(async () => {});
  const repository = {
    pending: vi.fn(async () => [row]),
    sessions: vi.fn(async () => []),
    delivered: vi.fn(async () => {}),
  };
  await dispatchRealtime(repository, { getByName: () => ({ publish }) });
  expect(publish).toHaveBeenCalledExactlyOnceWith(row.id, row.event, row.userId, []);
  expect(repository.sessions).not.toHaveBeenCalled();
  expect(repository.delivered).toHaveBeenCalledExactlyOnceWith([row.id]);
});

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
  expect(repository.delivered).toHaveBeenCalledExactlyOnceWith([row.id]);
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

it("acknowledges a published batch once and leaves the failed event pending", async () => {
  const channel = crypto.randomUUID();
  const rows = Array.from({ length: 3 }, () => ({
    id: crypto.randomUUID(),
    channel,
    userId: null,
    event: { id: crypto.randomUUID(), kind: "wallet" as const },
  }));
  const repository = {
    pending: async () => rows,
    sessions: vi.fn(async () => ["session"]),
    delivered: vi.fn(async () => undefined),
  };
  const publish = vi
    .fn(async () => undefined)
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("TRANSPORT_UNAVAILABLE"));
  await expect(dispatchRealtime(repository, { getByName: () => ({ publish }) })).rejects.toThrow(
    "TRANSPORT_UNAVAILABLE",
  );
  expect(repository.delivered).toHaveBeenCalledTimes(1);
  expect(repository.delivered).toHaveBeenCalledWith(rows.slice(0, 2).map((row) => row.id));
  expect(repository.sessions).toHaveBeenCalledTimes(1);
});
