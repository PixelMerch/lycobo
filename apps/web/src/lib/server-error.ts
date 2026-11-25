import { currentLocale } from "../i18n/locale-store";
import { currentMessages } from "../i18n/messages";
import { serverErrorMessages } from "./server-error-messages";

/** 服务端错误响应里用于提示的部分：中文原文与错误代码。 */
export type ServerFailure = { message: string; error: { code: string } };

/**
 * 积分不足统一按错误码本地化，兼容旧服务端文案；其他中文错误保留原文，
 * 英文按错误码显示，未知代码使用通用说明。
 */
export function serverErrorMessage(failure: ServerFailure) {
  const t = currentMessages(serverErrorMessages);
  if (failure.error.code === "INSUFFICIENT_CREDITS") return t.codes.INSUFFICIENT_CREDITS;
  if (currentLocale() === "zh-CN") return failure.message;
  const codes: Record<string, string> = t.codes;
  return codes[failure.error.code] ?? t.fallback;
}
