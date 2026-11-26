import {
  type ImageJob,
  type imageEventSchema,
  imageTasksResponseSchema,
} from "@lycoboai/contracts";
import type { QueryClient } from "@tanstack/react-query";
import { imageRequest } from "./generation-client";
import { cachedJob, jobsWaitingForReference, replaceJob } from "./task-sync";

// 批量接口最多接收 50 个任务 ID。
const statusBatchSize = 50;

/** 将任务推送合并为详情读取，钱包只由独立账本事件校准。 */
export function batchImageUpdates(client: QueryClient, isStopped: () => boolean) {
  let batchTimer: ReturnType<typeof setTimeout> | undefined;
  let request: AbortController | undefined;
  let flushing = false;
  let calibration = 0;
  let assetsChanged = false;
  const taskIds = new Set<string>();
  const calibrate = () => {
    calibration++;
    void client.invalidateQueries({ queryKey: ["wallet"] });
    void client.invalidateQueries({ queryKey: ["wallet-entries"] });
    void client.invalidateQueries({ queryKey: ["image-tasks"] });
    void client.invalidateQueries({ queryKey: ["image-task"] });
    void client.invalidateQueries({ queryKey: ["image-assets"] });
  };
  function applyJob(job: ImageJob) {
    if (taskIds.has(job.id)) return { history: false, assets: false };
    const previous = cachedJob(client, job.id);
    client.setQueryData(["image-task", job.id], job);
    return {
      history: !replaceJob(client, job),
      assets: job.items.some(
        (item) =>
          item.output_asset_id &&
          !previous?.items.some((old) => old.output_asset_id === item.output_asset_id),
      ),
    };
  }
  async function refreshJobs(ids: string[], snapshot: number, signal: AbortSignal) {
    const response = await imageRequest(`image-tasks/status?ids=${ids.join(",")}`, { signal });
    const { data } = imageTasksResponseSchema.parse(await response.json());
    if (isStopped()) return;
    if (snapshot !== calibration) {
      for (const id of ids) taskIds.add(id);
      return;
    }
    const updates = data.map(applyJob);
    return {
      history: data.length !== ids.length || updates.some((result) => result.history),
      assets: updates.some((result) => result.assets),
    };
  }
  function invalidateBatch(
    results: PromiseSettledResult<Awaited<ReturnType<typeof refreshJobs>>>[],
    updateAssets: boolean,
  ) {
    let reloadHistory = false;
    let reloadAssets = updateAssets;
    for (const result of results) {
      if (result.status === "rejected") {
        reloadHistory = true;
        continue;
      }
      reloadHistory ||= !!result.value?.history;
      reloadAssets ||= !!result.value?.assets;
    }
    if (reloadHistory) void client.invalidateQueries({ queryKey: ["image-tasks"] });
    if (reloadAssets) void client.invalidateQueries({ queryKey: ["image-assets"] });
  }
  const flush = async () => {
    batchTimer = undefined;
    if (isStopped() || flushing) return;
    flushing = true;
    const snapshot = calibration;
    const ids = [...taskIds];
    taskIds.clear();
    const updateAssets = assetsChanged;
    assetsChanged = false;
    request = new AbortController();
    const signal = request.signal;
    const batches = Array.from({ length: Math.ceil(ids.length / statusBatchSize) }, (_, index) =>
      ids.slice(index * statusBatchSize, (index + 1) * statusBatchSize),
    );
    const results = await Promise.allSettled(
      batches.map((batch) => refreshJobs(batch, snapshot, signal)),
    );
    request = undefined;
    if (!isStopped()) invalidateBatch(results, updateAssets);
    flushing = false;
    if (!isStopped() && (taskIds.size || assetsChanged))
      batchTimer = setTimeout(() => void flush(), 150);
  };
  const schedule = () => {
    if (!flushing && !batchTimer) batchTimer = setTimeout(() => void flush(), 150);
  };
  return {
    calibrate,
    enqueue(event: ReturnType<typeof imageEventSchema.parse>) {
      if (event.kind === "task") taskIds.add(event.resourceId);
      else {
        assetsChanged = true;
        for (const job of jobsWaitingForReference(client, event.resourceId)) taskIds.add(job.id);
      }
      schedule();
    },
    cancel() {
      clearTimeout(batchTimer);
      request?.abort();
    },
  };
}
