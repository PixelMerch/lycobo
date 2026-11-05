import { type imageEventSchema, imageJobSchema } from "@lycoboai/contracts";
import type { QueryClient } from "@tanstack/react-query";
import { imageRequest } from "./generation-client";
import { cachedJob, chargesChanged, replaceJob } from "./task-sync";

const fetchJob = (client: QueryClient, id: string) =>
  client.fetchQuery({
    queryKey: ["image-task", id],
    staleTime: 0,
    queryFn: async ({ signal }) =>
      imageJobSchema.parse(await (await imageRequest(`image-tasks/${id}`, { signal })).json()),
  });
export function batchImageUpdates(client: QueryClient, isStopped: () => boolean) {
  let batchTimer: ReturnType<typeof setTimeout> | undefined;
  let walletTimer: ReturnType<typeof setTimeout> | undefined;
  const refreshWallet = () => {
    if (walletTimer) return;
    walletTimer = setTimeout(() => {
      walletTimer = undefined;
      if (isStopped()) return;
      void client.invalidateQueries({ queryKey: ["wallet"] });
      void client.invalidateQueries({ queryKey: ["wallet-entries"] });
    }, 500);
  };
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
  async function refreshJob(id: string, snapshot: number) {
    const previous = cachedJob(client, id);
    const job = await fetchJob(client, id);
    if (isStopped()) return;
    if (snapshot !== calibration) {
      taskIds.add(id);
      return;
    }
    if (taskIds.has(id)) return;
    return {
      wallet: chargesChanged(previous, job),
      history: !replaceJob(client, job),
      assets: job.items.some((item) => item.output_asset_id),
    };
  }
  function invalidateBatch(
    results: PromiseSettledResult<Awaited<ReturnType<typeof refreshJob>>>[],
    updateAssets: boolean,
  ) {
    let reloadHistory = false;
    let walletChanged = false;
    let reloadAssets = updateAssets;
    for (const result of results) {
      if (result.status === "rejected") {
        reloadHistory = true;
        continue;
      }
      walletChanged ||= !!result.value?.wallet;
      reloadHistory ||= !!result.value?.history;
      reloadAssets ||= !!result.value?.assets;
    }
    if (walletChanged) refreshWallet();
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
    const results = await Promise.allSettled(ids.map((id) => refreshJob(id, snapshot)));
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
      else assetsChanged = true;
      schedule();
    },
    cancel() {
      clearTimeout(batchTimer);
      clearTimeout(walletTimer);
    },
  };
}
