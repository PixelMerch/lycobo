import type { ImageJob } from "@lycoboai/contracts";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { imageRequest } from "../generation/generation-client";
import { batchImageUpdates } from "../generation/image-event-updates";
import type { ImageHistory } from "../generation/task-sync";
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

it("素材就绪事件只重新读取引用该素材的待处理任务，并更新历史中的签名", async () => {
  vi.useFakeTimers();
  const assetId = crypto.randomUUID();
  const job: ImageJob = {
    id: crypto.randomUUID(),
    organization_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    model: "gpt-image-2",
    prompt: "参考图",
    resolution: "1K",
    aspect_ratio: "1:1",
    requested_count: 1,
    status: "queued",
    created_at: new Date().toISOString(),
    completed_at: null,
    input: {
      model: "gpt-image-2",
      prompt: "参考图片示例",
      resolution: "1K",
      aspectRatio: "1:1",
      count: 1,
      referenceAssetIds: [assetId],
    },
    items: [],
    reference_deliveries: {},
  };
  const url = "https://media.example/reference";
  const delivery = {
    url,
    thumbnail_url: url,
    download_url: url,
    expires_at: Math.floor(Date.now() / 1000) + 1800,
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const key = ["image-tasks", "variation"];
  client.setQueryData<ImageHistory>(key, { pages: [{ data: [job] }], pageParams: [""] });
  const request = vi.mocked(imageRequest).mockClear();
  request.mockResolvedValueOnce(
    Response.json({ data: [{ ...job, reference_deliveries: { [assetId]: delivery } }] }),
  );
  const updates = batchImageUpdates(client, () => false);
  updates.enqueue({ id: "1", kind: "asset", resourceId: crypto.randomUUID() });
  await vi.advanceTimersByTimeAsync(150);
  expect(request).not.toHaveBeenCalled();
  updates.enqueue({ id: "2", kind: "asset", resourceId: assetId });
  updates.enqueue({ id: "3", kind: "asset", resourceId: assetId });
  await vi.advanceTimersByTimeAsync(150);
  expect(request).toHaveBeenCalledExactlyOnceWith(`image-tasks/status?ids=${job.id}`, {
    signal: expect.any(AbortSignal),
  });
  expect(
    client.getQueryData<ImageHistory>(key)?.pages[0]?.data[0]?.reference_deliveries?.[assetId],
  ).toEqual(delivery);
  client.clear();
});

it("deduplicates task IDs, splits at the API limit, and fills the detail cache from a batch", async () => {
  vi.useFakeTimers();
  const jobs: ImageJob[] = Array.from({ length: 51 }, () => ({
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
    items: [],
  }));
  const request = vi.mocked(imageRequest).mockReset();
  request.mockResolvedValueOnce(Response.json({ data: jobs.slice(0, 50) }));
  request.mockResolvedValueOnce(Response.json({ data: jobs.slice(50) }));
  const client = new QueryClient();
  const updates = batchImageUpdates(client, () => false);
  for (const job of [...jobs, ...jobs])
    updates.enqueue({ id: "1", kind: "task", resourceId: job.id });
  await vi.advanceTimersByTimeAsync(150);
  expect(request).toHaveBeenCalledTimes(2);
  for (const [index, batch] of [jobs.slice(0, 50), jobs.slice(50)].entries()) {
    const ids = batch.map((job) => job.id).join(",");
    expect(request).toHaveBeenNthCalledWith(index + 1, `image-tasks/status?ids=${ids}`, {
      signal: expect.any(AbortSignal),
    });
  }
  for (const job of jobs) expect(client.getQueryData(["image-task", job.id])).toEqual(job);
  client.clear();
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
  vi.mocked(imageRequest).mockImplementation(async () => Response.json({ data: [job] }));
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
