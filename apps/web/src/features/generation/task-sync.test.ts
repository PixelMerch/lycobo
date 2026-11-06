import type { ImageJob } from "@lycoboai/contracts";
import { QueryClient } from "@tanstack/react-query";
import { expect, it } from "vitest";
import { cachedJob, type ImageHistory, replaceJob } from "./task-sync";

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

it("merges pushed task state into history without losing other tasks", () => {
  const first = job(),
    other = job();
  const client = withHistory(first, other);
  const changed = { ...first, status: "failed" as const };
  expect(replaceJob(client, changed)).toBe(true);
  expect(cachedJob(client, first.id)).toEqual(changed);
  expect(cachedJob(client, other.id)).toEqual(other);
  expect(replaceJob(client, job())).toBe(false);
});
