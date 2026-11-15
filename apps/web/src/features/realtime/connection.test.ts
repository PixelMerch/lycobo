import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { imageRequest } from "../generation/generation-client";
import { batchImageUpdates } from "../generation/image-event-updates";
import { connectRealtime } from "./connection";

vi.mock("../generation/generation-client", () => ({
  imageRequest: vi.fn(async () => new Response()),
}));
vi.mock("../generation/image-event-updates", () => ({
  batchImageUpdates: vi.fn(() => ({ calibrate: vi.fn(), enqueue: vi.fn(), cancel: vi.fn() })),
}));

class FakeSocket {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 1;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn((message: string) => {
    if (message === "ping") this.onmessage?.({ data: "pong" });
  });
  close = vi.fn();
  constructor(readonly url: URL) {
    FakeSocket.instances.push(this);
  }
  receive(frame: unknown) {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
}
function current() {
  const socket = FakeSocket.instances.at(-1);
  if (!socket) throw new Error("SOCKET_MISSING");
  return socket;
}
const ready = (cursor = "0", resync = true) => ({
  type: "ready",
  cursor,
  resync,
  release: null,
  expiresAt: Date.now() + 86400000,
});
beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.stubGlobal("location", { href: "https://fixture.example/", protocol: "https:" });
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("keeps business APIs idle and applies task, wallet and inbox events once", async () => {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const stop = connectRealtime(client, true);
  current().receive(ready());
  invalidate.mockClear();
  const event = { id: crypto.randomUUID(), kind: "task", resourceId: crypto.randomUUID() };
  current().receive({ type: "event", cursor: "1", event });
  current().receive({ type: "event", cursor: "1", event });
  current().receive({
    type: "event",
    cursor: "2",
    event: { id: crypto.randomUUID(), kind: "wallet" },
  });
  current().receive({
    type: "event",
    cursor: "3",
    event: { id: crypto.randomUUID(), kind: "notification" },
  });
  await vi.advanceTimersByTimeAsync(150);
  expect(batchImageUpdates).toHaveBeenCalled();
  const updates = vi.mocked(batchImageUpdates).mock.results.at(-1)?.value;
  expect(updates?.enqueue).toHaveBeenCalledTimes(1);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["wallet"] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["notifications"] });
  await vi.advanceTimersByTimeAsync(120000);
  expect(imageRequest).not.toHaveBeenCalled();
  expect(current().send).toHaveBeenCalledWith("ping");
  stop();
});
it("reconnects with the last cursor and cancels timers on sign out", async () => {
  const stop = connectRealtime(new QueryClient(), true);
  current().receive(ready("17", false));
  current().onclose?.();
  await vi.advanceTimersByTimeAsync(1500);
  expect(current().url.searchParams.get("cursor")).toBe("17");
  expect(imageRequest).toHaveBeenCalledTimes(1);
  stop();
  const count = FakeSocket.instances.length;
  await vi.advanceTimersByTimeAsync(120000);
  expect(FakeSocket.instances).toHaveLength(count);
});
it("keeps a healthy connection when returning to the foreground or receiving online events", async () => {
  const client = new QueryClient();
  const stop = connectRealtime(client, true);
  const socket = current();
  socket.receive(ready("17", false));
  const invalidate = vi.spyOn(client, "invalidateQueries");
  for (let index = 0; index < 5; index++) {
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("online"));
  }
  await vi.advanceTimersByTimeAsync(1500);
  expect(socket.close).not.toHaveBeenCalled();
  expect(FakeSocket.instances).toHaveLength(1);
  expect(imageRequest).not.toHaveBeenCalled();
  expect(invalidate).not.toHaveBeenCalled();
  stop();
});
it.each(["heartbeat", "expiry"])("reconnects after suspension when %s is stale", async (reason) => {
  const stop = connectRealtime(new QueryClient(), true);
  const socket = current();
  const expiresAt = Date.now() + (reason === "expiry" ? 120000 : 86400000);
  socket.receive({ ...ready("17", false), expiresAt });
  // 推进时钟但不执行定时器，模拟浏览器冻结后台页面后恢复。
  vi.setSystemTime(Date.now() + 65000);
  if (reason === "expiry") socket.onmessage?.({ data: "pong" });
  document.dispatchEvent(new Event("visibilitychange"));
  expect(socket.close).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1500);
  expect(FakeSocket.instances).toHaveLength(2);
  expect(current().url.searchParams.get("cursor")).toBe("17");
  expect(imageRequest).toHaveBeenCalledTimes(1);
  stop();
});
it("updates the release cache without reloading or changing the draft route", () => {
  const client = new QueryClient();
  const stop = connectRealtime(client, false);
  const release = {
    version: "new",
    title: "新功能",
    description: "已发布",
    publishedAt: new Date().toISOString(),
  };
  current().receive(ready());
  current().receive({
    type: "event",
    cursor: "1",
    event: { id: crypto.randomUUID(), kind: "release", release },
  });
  expect(client.getQueryData(["site-release"])).toEqual({ release });
  expect(location.href).toBe("https://fixture.example/");
  stop();
});
