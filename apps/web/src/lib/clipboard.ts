import { toast } from "@heroui/react";
import { currentMessages } from "../i18n/messages";
import { libMessages } from "./lib-messages";

/** 复制文字并用顶部提示告知结果；不传成功提示时显示“复制成功”。 */
export async function copyToClipboard(value: string, success?: string) {
  const t = currentMessages(libMessages);
  try {
    await navigator.clipboard.writeText(value);
    toast.success(success ?? t.copied);
  } catch {
    toast.danger(t.copyFailed);
  }
}
