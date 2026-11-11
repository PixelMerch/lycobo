import type { ImageJob } from "@lycoboai/contracts";
import type { Locale } from "../../i18n/locale";
import { workspaceToolMessages } from "../workspace/workspace-tool-messages";

/**
 * 家纺裂变任务固定提交的提示词标记：服务端按所选视角生成，不读这段文字，只把它存为任务提示词。
 * 不随界面语言变化；显示时用 displayPrompt 换成当前语言的工具名称。
 */
export const textilePromptMarker = "家纺裂变";

/** 从复制爆款的持久提示词中提取用户补充要求，保留其中的换行。 */
export function replicaUserPrompt(prompt: string) {
  return prompt.split("\n").slice(1).join("\n");
}

/** 历史记录展示提交时的用户内容，排除复制爆款模板与家纺固定标记。 */
export function userHistoryPrompt(job: Pick<ImageJob, "prompt" | "input">) {
  if (job.input?.replica) return replicaUserPrompt(job.prompt);
  if (job.input?.textileSet && job.prompt === textilePromptMarker) return "";
  return job.prompt;
}

/** 显示任务提示词：家纺裂变的固定标记换成当前语言的工具名称，用户写的提示词原样显示。 */
export function displayPrompt(prompt: string, locale: Locale) {
  if (prompt !== textilePromptMarker) return prompt;
  return workspaceToolMessages[locale].tools.textile.name;
}
