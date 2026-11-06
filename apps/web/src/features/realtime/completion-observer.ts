import { type ImageJob, imageJobSchema, imageTasksResponseSchema } from "@lycoboai/contracts";
import type { QueryClient } from "@tanstack/react-query";

function jobsForQuery(key: readonly unknown[], data: unknown) {
  if (key[0] === "image-task") {
    const parsed = imageJobSchema.safeParse(data);
    return parsed.success ? [parsed.data] : [];
  }
  if (key[0] !== "image-tasks") return [];
  if (!data || typeof data !== "object" || !("pages" in data) || !Array.isArray(data.pages))
    return [];
  const pages: unknown[] = data.pages;
  return pages.flatMap((page) => {
    const parsed = imageTasksResponseSchema.safeParse(page);
    return parsed.success ? parsed.data.data : [];
  });
}

/** 观察现有任务缓存，实时读取和断线校准都能触发提醒，不增加网络请求。 */
export function observeCompletedJobs(
  client: QueryClient,
  receive: (job: ImageJob, previous?: ImageJob) => void,
) {
  const snapshots = new Map<string, ImageJob>();
  for (const query of client.getQueryCache().getAll()) {
    for (const job of jobsForQuery(query.queryKey, query.state.data)) snapshots.set(job.id, job);
  }
  return client.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" || event.action.type !== "success") return;
    for (const job of jobsForQuery(event.query.queryKey, event.query.state.data)) {
      const previous = snapshots.get(job.id);
      snapshots.set(job.id, job);
      receive(job, previous);
    }
    // 提醒历史由本机回执去重，缓存快照只保留近期任务，避免长期开页持续增长。
    while (snapshots.size > 500) {
      const first = snapshots.keys().next().value;
      if (first) snapshots.delete(first);
    }
  });
}
