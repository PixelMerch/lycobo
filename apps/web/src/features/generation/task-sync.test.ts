import type { ImageJob } from "@lycoboai/contracts";
import { QueryClient } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import {
  type ImageHistory,
  pollDelay,
  reconnectPlan,
  refreshUnfinished,
  unfinishedJobs,
} from "./task-sync";

const item = (overrides: Partial<ImageJob["items"][number]> = {}) => ({
  id: crypto.randomUUID(),
  position: 0,
  status: "running" as const,
  output_asset_id: null,
  error_code: null,
  width: null,
  height: null,
  worker_id: null,
  ...overrides,
});
const job = (overrides: Partial<ImageJob> = {}): ImageJob => ({
  id: crypto.randomUUID(),
  organization_id: crypto.randomUUID(),
  user_id: crypto.randomUUID(),
  model: "gpt-image-2",
  prompt: "fixture",
  resolution: "1K",
  aspect_ratio: "1:1",
  requested_count: 1,
  status: "running",
  created_at: new Date().toISOString(),
  completed_at: null,
  items: [item()],
  ...overrides,
});
const withHistory = (...jobs: ImageJob[]) => {
  const client = new QueryClient();
  client.setQueryData<ImageHistory>(["image-tasks"], { pages: [{ data: jobs }], pageParams: [""] });
  return client;
};

it("polls only unfinished tasks from history pages and single-task caches", () => {
  const running = job();
  const finished = job({ status: "succeeded" });
  const edit = job({ status: "queued" });
  const client = withHistory(running, finished);
  client.setQueryData(["image-task", running.id], running);
  client.setQueryData(["image-task", edit.id], edit);
  expect(unfinishedJobs(client).map((entry) => entry.id)).toEqual([running.id, edit.id]);
  expect(unfinishedJobs(withHistory(finished))).toEqual([]);
});

it("polls new work quickly, long work slowly and backs off after failures", () => {
  const now = Date.parse("2026-11-01T00:10:00Z");
  const recent = job({ created_at: "2026-11-01T00:09:30Z" });
  const long = job({ created_at: "2026-11-01T00:05:00Z" });
  const stuck = job({ created_at: "2026-11-01T00:00:00Z" });
  expect(pollDelay([long, recent], false, 0, now)).toBe(15000);
  expect(pollDelay([long], false, 0, now)).toBe(15000);
  expect(pollDelay([stuck], false, 0, now)).toBe(30000);
  expect(pollDelay([recent], true, 0, now)).toBe(30000);
  expect(pollDelay([recent], false, 2, now)).toBe(60000);
  expect(pollDelay([long], false, 9, now)).toBe(60000);
});

it("uses the freshest snapshot before deciding to poll, including a later retry", () => {
  const running = job();
  const client = withHistory();
  client.setQueryData<ImageHistory>(
    ["image-tasks"],
    { pages: [{ data: [running] }], pageParams: [""] },
    { updatedAt: 100 },
  );
  client.setQueryData(
    ["image-task", running.id],
    { ...running, status: "succeeded" },
    { updatedAt: 200 },
  );
  expect(unfinishedJobs(client)).toEqual([]);
  const retry = { ...running, status: "queued" as const };
  client.setQueryData<ImageHistory>(
    ["image-tasks"],
    { pages: [{ data: [retry] }], pageParams: [""] },
    { updatedAt: 300 },
  );
  expect(unfinishedJobs(client)).toEqual([retry]);
});

it("removes a confirmed missing task from every history so a failed history reload cannot keep polling it", async () => {
  const missing = job();
  const other = job();
  const client = withHistory(missing, other);
  client.setQueryData<ImageHistory>(["image-tasks", "create"], {
    pages: [{ data: [missing] }],
    pageParams: [""],
  });
  client.setQueryData(["image-task", missing.id], missing);
  expect(await refreshUnfinished(client, [missing], async () => null)).toMatchObject({
    history: true,
    failed: false,
  });
  expect(unfinishedJobs(client)).toEqual([other]);
});

it("backs off event-stream reconnects and re-checks the events capability every third failure", () => {
  const plans = Array.from({ length: 7 }, (_, index) => reconnectPlan(index + 1));
  expect(plans.map((plan) => plan.delay)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  expect(plans.map((plan) => plan.recheck)).toEqual([
    false,
    false,
    true,
    false,
    false,
    true,
    false,
  ]);
});

it("leaves caches untouched while polled tasks are unchanged", async () => {
  const running = job();
  const client = withHistory(running);
  const before = client.getQueryData(["image-tasks"]);
  const followUp = await refreshUnfinished(client, [running], async () => structuredClone(running));
  expect(followUp).toEqual({ wallet: false, assets: false, history: false, failed: false });
  expect(client.getQueryData(["image-tasks"])).toBe(before);
});

it("folds completed outputs and refunds into history with matching follow-ups", async () => {
  const output = crypto.randomUUID();
  const done = item();
  const failing = item({ position: 1 });
  const running = job({ requested_count: 2, items: [done, failing] });
  const client = withHistory(running);
  const settled = job({
    ...running,
    status: "partially_failed",
    items: [
      { ...done, status: "succeeded", output_asset_id: output },
      { ...failing, status: "failed", error_code: "PROVIDER_ERROR" },
    ],
  });
  const followUp = await refreshUnfinished(client, [running], async () => settled);
  expect(followUp).toEqual({ wallet: true, assets: true, history: false, failed: false });
  expect(client.getQueryData<ImageHistory>(["image-tasks"])?.pages[0]?.data[0]).toEqual(settled);
});

it("does not refresh the wallet when work only starts or succeeds", async () => {
  const pending = item({ status: "queued" });
  const queued = job({ status: "queued", items: [pending] });
  const client = withHistory(queued);
  const started = job({ ...queued, items: [{ ...pending, status: "running" }] });
  expect(await refreshUnfinished(client, [queued], async () => started)).toMatchObject({
    wallet: false,
    assets: false,
  });
  const output = crypto.randomUUID();
  const succeeded = job({
    ...started,
    status: "succeeded",
    items: [{ ...pending, status: "succeeded", output_asset_id: output }],
  });
  expect(await refreshUnfinished(client, [started], async () => succeeded)).toMatchObject({
    wallet: false,
    assets: true,
  });
});

it("reloads history for tasks outside loaded pages, removed tasks and keeps failures retryable", async () => {
  const edit = job({ status: "queued" });
  const client = withHistory();
  client.setQueryData(["image-task", edit.id], edit);
  expect(
    await refreshUnfinished(client, [edit], async () => ({ ...edit, status: "running" })),
  ).toMatchObject({ history: true });
  const gone = await refreshUnfinished(client, [edit], async () => null);
  expect(gone).toMatchObject({ history: true, failed: false });
  expect(client.getQueryData(["image-task", edit.id])).toBeUndefined();
  const offline = vi.fn().mockRejectedValue(new Error("offline"));
  expect(await refreshUnfinished(client, [edit], offline)).toMatchObject({ failed: true });
});
