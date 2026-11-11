import type { ImageJob } from "@lycoboai/contracts";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";

export type ImageHistory = InfiniteData<{ data: ImageJob[] }, string>;

const historyJobs = (client: QueryClient) =>
  client
    .getQueriesData<ImageHistory>({ queryKey: ["image-tasks"] })
    .flatMap(([, history]) => history?.pages.flatMap((page) => page.data) ?? []);

/** 从历史页或详情缓存读取当前任务快照。 */
export const cachedJob = (client: QueryClient, id: string) =>
  historyJobs(client).find((job) => job.id === id) ??
  client.getQueryData<ImageJob>(["image-task", id]);

/** 找出缓存中仍在等待这张参考图的任务。 */
export function jobsWaitingForReference(client: QueryClient, assetId: string) {
  return historyJobs(client).filter(
    (job) =>
      job.status === "queued" &&
      job.reference_deliveries !== undefined &&
      !job.reference_deliveries[assetId] &&
      job.input?.referenceAssetIds.includes(assetId),
  );
}

/** 将推送后读取的任务同步到已加载历史，避免重载整个列表。 */
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
