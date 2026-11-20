import { toast } from "@heroui/react";
import { currentMessages } from "../i18n/messages";
import { libMessages } from "./lib-messages";

/** 返回剪贴板写入结果，允许调用方用自己的成功反馈替代顶部提示。 */
export async function copyToClipboard(value: string, success?: string | false) {
  const t = currentMessages(libMessages);
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    toast.danger(t.copyFailed);
    return false;
  }
  if (success !== false) toast.success(success ?? t.copied);
  return true;
}
