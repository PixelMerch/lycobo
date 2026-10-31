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
  const jobs = new Map<string, ImageJob>();
  for (const job of [
    ...historyJobs(client),
    ...client
      .getQueriesData<ImageJob>({ queryKey: ["image-task"] })
      .flatMap(([, job]) => (job ? [job] : [])),
  ])
    if ((job.status === "queued" || job.status === "running") && !jobs.has(job.id))
      jobs.set(job.id, job);
  return [...jobs.values()];
}

/**
 * Live events need only a slow safety net. Polling slows as the newest task ages (most finish
 * within two minutes; one still running after ten has usually lost its worker) and on failure.
 */
export function pollDelay(jobs: ImageJob[], liveEvents: boolean, failures: number, now: number) {
  const age = Math.min(...jobs.map((job) => now - Date.parse(job.created_at)));
  const base = liveEvents || age >= 600000 ? 30000 : age < 120000 ? 4000 : 10000;
  return Math.min(60000, base * 2 ** Math.min(failures, 4));
}

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
