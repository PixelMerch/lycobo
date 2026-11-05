import { Toast } from "@heroui/react";
import { useEffect, useRef } from "react";

/**
 * Local-edit status channel. It deliberately uses its own queue and a
 * bottom-right region: task progress is transient feedback, so it must not sit
 * inside the form, cover the picture, or stack with the global top toasts
 * ("复制成功").
 */
const repairQueue = new Toast.Queue({ maxVisibleToasts: 2 });

const NOTICE_TIMEOUT = 8000;

/** Mounts the bottom-right region once per preview workspace. */
export function RepairNoticeRegion() {
  return <Toast.Provider placement="bottom end" queue={repairQueue} maxVisibleToasts={2} />;
}

const endedStatuses = ["failed", "partially_failed", "needs_reconciliation"];

function repairStage(status: string | undefined, succeeded: boolean) {
  if (status === undefined || status === "queued" || status === "running") return "running";
  return succeeded ? "succeeded" : status;
}

function repairMessage(stage: string | null) {
  if (stage === "running") return "修改版生成中，可返回详情继续查看图片";
  if (stage === "succeeded") return "修改版已生成，可点击查看";
  return stage && endedStatuses.includes(stage)
    ? "修改版未能完成，请在历史记录查看任务与积分状态"
    : null;
}

/**
 * Announces the edit task once per state change. The toast auto-dismisses, so
 * repeated polls of the same state never re-notify.
 */
export function useRepairNotice({
  jobId,
  status,
  succeeded,
}: {
  jobId: string | undefined;
  status: string | undefined;
  succeeded: boolean;
}) {
  const shown = useRef<string | null>(null);
  /* Collapse "not loaded yet", queued and running into one stage, so polling
   * the same task cannot post the same notice twice. */
  const stage = jobId ? repairStage(status, succeeded) : null;
  const key = jobId && stage ? `${jobId}:${stage}` : null;
  useEffect(() => {
    if (!key) {
      shown.current = null;
      return;
    }
    if (shown.current === key) return;
    shown.current = key;
    const message = repairMessage(stage);
    if (message) repairQueue.add({ title: message }, { timeout: NOTICE_TIMEOUT });
  }, [key, stage]);
}
