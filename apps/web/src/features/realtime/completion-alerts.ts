import type { ImageJob } from "@lycoboai/contracts";
import { type CompletedResult, claimCompletion, completionStorage } from "./completion-storage";
import { showDesktopCompletion } from "./desktop-notifications";

/** 只生成本站历史定位，不携带图片签名、任务输入或恢复草稿指令。 */
export function completedResult(job: ImageJob): CompletedResult {
  let path = "/create";
  if (job.input?.textileSet) path = "/commerce/textile-set";
  if (job.input?.variation) path = "/commerce/smart-variation";
  return { id: job.id, path: `${path}?task=${job.id}`, label: "图片生成完成" };
}

/** 只有任务结果确实处于当前可见区域时，才省略全局提示。 */
export function isViewingResult(id: string) {
  if (document.visibilityState === "hidden" || document.querySelector('[role="dialog"]'))
    return false;
  const box = document.getElementById(`job-${id}`)?.getBoundingClientRect();
  return !!box && box.width > 0 && box.height > 0 && box.bottom > 60 && box.top < innerHeight;
}

type Options = {
  scope: string;
  userId: string;
  organizationId: string;
  open: (result: CompletedResult) => void;
  notify: (results: CompletedResult[], open: () => void) => void;
};

/** 将真实任务完成转换为去重提醒，切页、重连与历史回放都不会自动导航。 */
export function createCompletionAlerts(options: Options) {
  const receipts = completionStorage(options.scope);
  const startedAt = Date.now();
  const originalTitle = document.title;
  const notices = new Map<string, Notification>();
  let stopped = false;
  const updateTitle = () => {
    const count = receipts.read().pending.length;
    document.title =
      count && document.visibilityState === "hidden"
        ? `（${count}）生成完成 · Lycobo`
        : originalTitle;
  };
  const open = (result: CompletedResult) => {
    if (!stopped) options.open(result);
  };
  const present = () =>
    claimCompletion(receipts.key, () => {
      if (stopped || document.visibilityState === "hidden") return;
      const state = receipts.read();
      const pending = state.pending.filter((result) => !isViewingResult(result.id));
      receipts.write({ ...state, pending: [] });
      for (const notice of notices.values()) notice.close();
      notices.clear();
      updateTitle();
      const last = pending.at(-1);
      if (last) options.notify(pending, () => open(last));
    });
  const resume = () => {
    void present().catch(() => undefined);
    updateTitle();
  };
  const synchronize = (event: StorageEvent) => {
    if (event.key !== receipts.key) return;
    if (document.visibilityState === "hidden") updateTitle();
    else resume();
  };
  document.addEventListener("visibilitychange", resume);
  window.addEventListener("storage", synchronize);
  updateTitle();
  void present().catch(() => undefined);
  async function receive(job: ImageJob, previous?: ImageJob) {
    if (!isNewCompletion(job, previous, options, startedAt)) return;
    await claimCompletion(receipts.key, () => {
      if (stopped) return;
      const state = receipts.read();
      if (state.seen.includes(job.id)) return;
      const result = completedResult(job);
      const pending = isViewingResult(job.id) ? state.pending : [...state.pending, result];
      receipts.write({ seen: [...state.seen, job.id], pending });
      updateTitle();
      if (document.visibilityState !== "hidden" || !pending.includes(result)) return;
      showNotice(result);
    });
    await present();
  }
  function showNotice(result: CompletedResult) {
    const notice = showDesktopCompletion(options.scope, result.id, () => open(result));
    if (notice) notices.set(result.id, notice);
  }
  return {
    receive,
    stop() {
      stopped = true;
      document.title = originalTitle;
      for (const notice of notices.values()) notice.close();
      notices.clear();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("storage", synchronize);
    },
  };
}

function isNewCompletion(
  job: ImageJob,
  previous: ImageJob | undefined,
  options: Options,
  start: number,
) {
  if (job.user_id !== options.userId || job.organization_id !== options.organizationId)
    return false;
  if (job.status !== "succeeded" && job.status !== "partially_failed") return false;
  if (!job.items.some((item) => item.status === "succeeded" && item.output_asset_id)) return false;
  const wasPending =
    previous && ["running", "queued", "needs_reconciliation"].includes(previous.status);
  // 首次连接会回放历史；只提醒已观察到的执行，或本次打开页面后完成的任务。
  return !!wasPending || Date.parse(job.completed_at ?? "") >= start;
}
