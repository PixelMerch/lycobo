import type { ImageJob } from "@lycoboai/contracts";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { imageRequest } from "../generation/generation-client";
import { refreshWithoutRealtime } from "./availability";
import { connectRealtime } from "./connection";

vi.mock("../generation/generation-client", () => ({ imageRequest: vi.fn() }));
class Socket {
  static OPEN = 1;
  static latest: Socket | undefined;
  readyState = 1;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    Socket.latest = this;
  }
  send = vi.fn();
  close = vi.fn();
  receive(frame: unknown) {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("coalesces a wallet event and the matching task update without canceling the active balance read", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
  vi.stubGlobal("location", { href: "https://fixture.example/", protocol: "https:" });
  const job: ImageJob = {
    id: crypto.randomUUID(),
    organization_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    model: "gpt-image-2",
    prompt: "fixture",
    resolution: "1K",
    aspect_ratio: "1:1",
    requested_count: 1,
    status: "queued",
    created_at: new Date().toISOString(),
    completed_at: null,
    items: [
      {
        id: crypto.randomUUID(),
        position: 0,
        status: "queued",
        output_asset_id: null,
        error_code: null,
        width: null,
        height: null,
        worker_id: null,
      },
    ],
  };
  vi.mocked(imageRequest).mockResolvedValue(new Response(JSON.stringify(job)));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let requests = 0;
  let cancellations = 0;
  const observer = new QueryObserver(client, {
    queryKey: ["wallet"],
    initialData: { balance: 200 },
    staleTime: Infinity,
    queryFn: ({ signal }) => {
      requests++;
      signal.addEventListener("abort", () => {
        cancellations++;
      });
      return new Promise((resolve) => setTimeout(() => resolve({ balance: 198 }), 2000));
    },
  });
  const unsubscribe = observer.subscribe(() => undefined);
  const stop = connectRealtime(client, true);
  const socket = Socket.latest;
  if (!socket) throw new Error("SOCKET_MISSING");
  socket.receive({
    type: "ready",
    cursor: "0",
    resync: false,
    release: null,
    expiresAt: Date.now() + 86400000,
  });
  socket.receive({
    type: "event",
    cursor: "1",
    event: { id: crypto.randomUUID(), kind: "wallet" },
  });
  refreshWithoutRealtime(client, "wallet", "wallet-entries");
  socket.receive({
    type: "event",
    cursor: "2",
    event: { id: crypto.randomUUID(), kind: "task", resourceId: job.id },
  });
  await vi.advanceTimersByTimeAsync(1000);
  expect(requests).toBe(1);
  expect(cancellations).toBe(0);
  stop();
  unsubscribe();
  client.clear();
});
