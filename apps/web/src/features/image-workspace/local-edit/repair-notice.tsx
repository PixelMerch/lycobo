import { Toast } from "@heroui/react";
import { useEffect, useRef } from "react";
import { currentMessages } from "../../../i18n/messages";
import { imageWorkspaceMessages } from "../image-workspace-messages";

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
  const t = currentMessages(imageWorkspaceMessages);
  if (stage === "running") return t.editRunning;
  if (stage === "succeeded") return t.editDone;
  return stage && endedStatuses.includes(stage) ? t.editFailed : null;
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
