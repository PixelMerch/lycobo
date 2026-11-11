import { type ImageJob, imageUserPrompt } from "@lycoboai/contracts";
import type { Locale } from "../../i18n/locale";
import { workspaceToolMessages } from "../workspace/workspace-tool-messages";

/**
 * 家纺裂变任务固定提交的提示词标记：服务端按所选视角生成，不读这段文字，只把它存为任务提示词。
 * 不随界面语言变化；显示时用 displayPrompt 换成当前语言的工具名称。
 */
export const textilePromptMarker = "家纺裂变";

/** 历史优先读取独立用户字段，兼容尚未回填或旧版接口返回的任务。 */
export function userHistoryPrompt(job: Pick<ImageJob, "prompt" | "input" | "user_prompt">) {
  return job.user_prompt ?? imageUserPrompt(job.prompt, job.input);
}

/** 显示任务提示词：家纺裂变的固定标记换成当前语言的工具名称，用户写的提示词原样显示。 */
export function displayPrompt(prompt: string, locale: Locale) {
  if (prompt !== textilePromptMarker) return prompt;
  return workspaceToolMessages[locale].tools.textile.name;
}
