import { type imageJobSchema, imageTasksResponseSchema } from "@lycoboai/contracts";
import type { QueryClient } from "@tanstack/react-query";
import { imageRequest } from "./generation-client";
import { pollDelay, refreshUnfinished, unfinishedJobs } from "./task-sync";

async function fetchTaskBatches(
  client: QueryClient,
  jobs: ReturnType<typeof unfinishedJobs>,
  isStopped: () => boolean,
) {
  const results = new Map<string, ReturnType<typeof imageJobSchema.parse>>();
  const failed = new Set<string>();
  // Bounded sequential batches avoid both per-task round trips and an unbounded fan-out.
  for (let offset = 0; offset < jobs.length && !isStopped(); offset += 50) {
    const batch = jobs.slice(offset, offset + 50);
    try {
      const ids = batch.map((job) => job.id).join(",");
      const response = imageTasksResponseSchema.parse(
        await (await imageRequest(`image-tasks/status?ids=${ids}`)).json(),
      );
      if (isStopped()) break;
      for (const job of response.data) {
        results.set(job.id, job);
        client.setQueryData(["image-task", job.id], job);
      }
    } catch {
      for (const job of batch) failed.add(job.id);
    }
  }
  return { results, failed };
}

function invalidatePollingResults(
  client: QueryClient,
  followUp: Awaited<ReturnType<typeof refreshUnfinished>>,
) {
  if (followUp.wallet) {
    void client.invalidateQueries({ queryKey: ["wallet"] });
    void client.invalidateQueries({ queryKey: ["wallet-entries"] });
  }
  if (followUp.history) void client.invalidateQueries({ queryKey: ["image-tasks"] });
  if (followUp.assets) void client.invalidateQueries({ queryKey: ["image-assets"] });
}

// Behind a live event stream polling is a slow safety net for lost events.
export function pollImageTasks(client: QueryClient, enabled: boolean) {
  let stopped = false;
  let polling = false;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    if (stopped || polling || timer || document.visibilityState === "hidden") return;
    const jobs = unfinishedJobs(client);
    if (jobs.length)
      timer = setTimeout(() => void poll(), pollDelay(jobs, enabled, failures, Date.now()));
  };
  const poll = async () => {
    clearTimeout(timer);
    timer = undefined;
    if (stopped || polling || document.visibilityState === "hidden") return;
    const jobs = unfinishedJobs(client);
    if (!jobs.length) return;
    polling = true;
    const { results, failed } = await fetchTaskBatches(client, jobs, () => stopped);
    if (stopped) return;
    const followUp = await refreshUnfinished(client, jobs, async (id) => {
      if (failed.has(id)) throw new Error("TASK_BATCH_UNAVAILABLE");
      return results.get(id) ?? null;
    });
    polling = false;
    if (stopped) return;
    failures = followUp.failed ? failures + 1 : 0;
    invalidatePollingResults(client, followUp);
    schedule();
  };
  const unsubscribe = client.getQueryCache().subscribe(({ query }) => {
    const [key] = query.queryKey;
    if (key === "image-tasks" || key === "image-task") schedule();
  });
  const onVisibility = () => void poll();
  document.addEventListener("visibilitychange", onVisibility);
  schedule();
  return () => {
    stopped = true;
    clearTimeout(timer);
    unsubscribe();
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
