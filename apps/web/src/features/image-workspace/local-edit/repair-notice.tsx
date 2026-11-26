import { Toast } from "@heroui/react";
import { useEffect, useRef } from "react";
import { currentMessages } from "../../../i18n/messages";
import { toastTimeout } from "../../../lib/toast";
import { imageWorkspaceMessages } from "../image-workspace-messages";

/* 局部修补使用右下角独立队列，避免与顶部全局提示叠放。 */
const repairQueue = new Toast.Queue({ maxVisibleToasts: 2 });

/** 在预览工作区挂载右下角状态提示。 */
export function RepairNoticeRegion() {
  return <Toast.Provider placement="bottom end" queue={repairQueue} maxVisibleToasts={2} />;
}

const endedStatuses = ["failed", "partially_failed", "needs_reconciliation"];

function repairStage(status: string | undefined, succeeded: boolean) {
  if (status === undefined || status === "queued" || status === "running") return "running";
  return succeeded ? "succeeded" : status;
}

function repairMessage(stage: string | null) {
  const t = currentMessages(imageWorkspaceMessages);
  if (stage === "running") return t.editRunning;
  if (stage === "succeeded") return t.editDone;
  return stage && endedStatuses.includes(stage) ? t.editFailed : null;
}

/** 修补任务每次切换状态只提示一次，避免轮询重复通知。 */
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
  /* 尚未加载、排队和运行中的状态共用一条进行中提示。 */
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
    if (message) repairQueue.add({ title: message }, { timeout: toastTimeout });
  }, [key, stage]);
}
