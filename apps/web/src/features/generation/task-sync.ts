import type { ImageJob } from "@lycoboai/contracts";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";

export type ImageHistory = InfiniteData<{ data: ImageJob[] }, string>;

const historyJobs = (client: QueryClient) =>
  client
    .getQueriesData<ImageHistory>({ queryKey: ["image-tasks"] })
    .flatMap(([, history]) => history?.pages.flatMap((page) => page.data) ?? []);

export const cachedJob = (client: QueryClient, id: string) =>
  historyJobs(client).find((job) => job.id === id) ??
  client.getQueryData<ImageJob>(["image-task", id]);

/** Writes a refreshed task into every loaded history page; false when no page holds it. */
export function replaceJob(client: QueryClient, job: ImageJob) {
  let found = false;
  client.setQueriesData<ImageHistory>({ queryKey: ["image-tasks"] }, (current) => {
    if (!current) return current;
    return {
      ...current,
      pages: current.pages.map((page) => ({
        ...page,
        data: page.data.map((old) => {
          if (old.id !== job.id) return old;
          found = true;
          return job;
        }),
      })),
    };
  });
  return found;
}

// Starting/completing work does not change the prepaid wallet. New attempts
// charge once; a newly failed item refunds once. Replayed updates do neither.
export const chargesChanged = (previous: ImageJob | undefined, job: ImageJob) =>
  !previous ||
  job.items.some((item) => {
    const old = previous.items.find((entry) => entry.id === item.id);
    return !old || (item.status === "failed" && old.status !== "failed");
  });

export function unfinishedJobs(client: QueryClient) {
  const jobs = new Map<string, { job: ImageJob; updatedAt: number }>();
  const remember = (job: ImageJob, updatedAt: number) => {
    const prior = jobs.get(job.id);
    if (!prior || updatedAt >= prior.updatedAt) jobs.set(job.id, { job, updatedAt });
  };
  for (const query of client.getQueryCache().findAll({ queryKey: ["image-tasks"] })) {
    const history = client.getQueryData<ImageHistory>(query.queryKey);
    for (const job of history?.pages.flatMap((page) => page.data) ?? [])
      remember(job, query.state.dataUpdatedAt);
  }
  for (const query of client.getQueryCache().findAll({ queryKey: ["image-task"] })) {
    const job = client.getQueryData<ImageJob>(query.queryKey);
    if (job) remember(job, query.state.dataUpdatedAt);
  }
  // Resolve conflicting snapshots before filtering. An old running history page must not
  // resurrect a completed task, and a newer explicit retry must remain eligible for polling.
  return [...jobs.values()]
    .map(({ job }) => job)
    .filter((job) => job.status === "queued" || job.status === "running");
}

/**
 * Live events need only a slow safety net. Polling slows as the newest task ages (most finish
 * within two minutes; one still running after ten has usually lost its worker) and on failure.
 */
export function pollDelay(jobs: ImageJob[], liveEvents: boolean, failures: number, now: number) {
  const age = Math.min(...jobs.map((job) => now - Date.parse(job.created_at)));
  const base = liveEvents || age >= 600000 ? 30000 : 15000;
  return Math.min(60000, base * 2 ** Math.min(failures, 4));
}

/**
 * Reconnect timing for the `failure`-th consecutive event-stream failure: exponential backoff to
 * 30 s and, every third failure, a re-check that the server still offers live events. EventSource
 * errors carry no HTTP status, so this is how a stream the server stopped offering ends instead of
 * being retried for as long as the tab stays open.
 */
export const reconnectPlan = (failure: number) => ({
  delay: Math.min(30000, 1000 * 2 ** Math.min(failure - 1, 5)),
  recheck: failure % 3 === 0,
});

const fingerprint = (job: ImageJob) =>
  JSON.stringify([
    job.status,
    job.items.map((item) => [item.id, item.status, item.output_asset_id, item.error_code]),
  ]);

/**
 * Refetches unfinished tasks and folds changes into cached history. `fetchJob` resolves null
 * when the task no longer exists. Returns the follow-up refreshes the caller should run.
 */
export async function refreshUnfinished(
  client: QueryClient,
  jobs: ImageJob[],
  fetchJob: (id: string) => Promise<ImageJob | null>,
) {
  const followUp = { wallet: false, assets: false, history: false, failed: false };
  await Promise.all(
    jobs.map(async (previous) => {
      let job: ImageJob | null;
      try {
        job = await fetchJob(previous.id);
      } catch {
        followUp.failed = true;
        return;
      }
      if (!job) {
        client.removeQueries({ queryKey: ["image-task", previous.id], exact: true });
        client.setQueriesData<ImageHistory>(
          { queryKey: ["image-tasks"] },
          (history) =>
            history && {
              ...history,
              pages: history.pages.map((page) => ({
                ...page,
                data: page.data.filter((entry) => entry.id !== previous.id),
              })),
            },
        );
        followUp.history = true;
        return;
      }
      if (fingerprint(job) === fingerprint(previous)) return;
      if (chargesChanged(previous, job)) followUp.wallet = true;
      if (
        job.items.some(
          (item) =>
            item.output_asset_id &&
            !previous.items.some((old) => old.output_asset_id === item.output_asset_id),
        )
      )
        followUp.assets = true;
      if (!replaceJob(client, job)) followUp.history = true;
    }),
  );
  return followUp;
}
