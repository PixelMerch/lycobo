import type { VideoTask } from "@lycoboai/contracts";
import { currentMessages } from "../../../i18n/messages";
import { videoHistoryMessages } from "./video-history-messages";

/** 视频任务是否还在排队或生成。 */
export const isVideoTaskActive = (task: VideoTask) =>
  task.status === "queued" || task.status === "running";

/** 视频任务当前状态的说明，细分参考图失效、暂停、待确认与正在保存。 */
export function videoTaskStatus(task: VideoTask) {
  const t = currentMessages(videoHistoryMessages);
  if (task.status === "failed" && task.error_code === "VIDEO_REFERENCES_UNAVAILABLE")
    return t.referencesUnavailable;
  if (task.status !== "running") return t.statuses[task.status];
  if (task.provider_status === "paused") return t.paused;
  if (task.provider_status === "pending_confirmation") return t.pendingConfirmation;
  if (task.provider_status === "completed") return t.saving;
  return t.statuses.running;
}
