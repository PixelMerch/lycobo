import { currentLocale } from "../i18n/locale-store";
import { currentMessages } from "../i18n/messages";
import { serverErrorMessages } from "./server-error-messages";

/** 服务端错误响应里用于提示的部分：中文原文与错误代码。 */
export type ServerFailure = { message: string; error: { code: string } };

/**
 * 服务端错误的提示文字。服务端只返回中文原文：中文界面原样显示，
 * 英文界面按错误代码换成英文说明，未知代码用通用说明。
 */
export function serverErrorMessage(failure: ServerFailure) {
  if (currentLocale() === "zh-CN") return failure.message;
  const t = currentMessages(serverErrorMessages);
  const codes: Record<string, string> = t.codes;
  return codes[failure.error.code] ?? t.fallback;
}
