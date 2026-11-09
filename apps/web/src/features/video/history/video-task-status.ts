import type { VideoTask } from "@lycoboai/contracts";

const statusText = {
  queued: "排队中",
  running: "生成中",
  succeeded: "已完成",
  failed: "生成失败，积分已退回",
  needs_reconciliation: "结果待核对，请勿重复提交",
};

export const isVideoTaskActive = (task: VideoTask) =>
  task.status === "queued" || task.status === "running";

export function videoTaskStatus(task: VideoTask) {
  if (task.status === "failed" && task.error_code === "VIDEO_REFERENCES_UNAVAILABLE")
    return "参考图无法读取，视频积分已退回";
  if (task.status !== "running") return statusText[task.status];
  if (task.provider_status === "paused") return "任务暂停，等待恢复";
  if (task.provider_status === "pending_confirmation") return "结果待确认，请勿重复提交";
  if (task.provider_status === "completed") return "正在保存视频";
  return statusText.running;
}
