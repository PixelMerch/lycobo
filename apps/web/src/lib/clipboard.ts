import { currentMessages } from "../i18n/messages";
import { libMessages } from "./lib-messages";
import { toast } from "./toast";

/** 复制现成文字或按需读取内容，并在顶部提示复制结果。 */
export async function copyToClipboard(value: string | (() => Promise<string>), success?: string) {
  const t = currentMessages(libMessages);
  try {
    const clipboard = navigator.clipboard;
    if (!clipboard) throw new Error("CLIPBOARD_UNAVAILABLE");
    if (typeof value === "string") await clipboard.writeText(value);
    else if (typeof ClipboardItem === "undefined" || !clipboard.write)
      await clipboard.writeText(await value());
    else {
      // 在点击时启动写入授权，网络结果回来后再提供内容，兼容 Safari 的用户激活限制。
      const data = value().then((text) => new Blob([text], { type: "text/plain" }));
      void data.catch(() => undefined);
      await clipboard.write([new ClipboardItem({ "text/plain": data })]);
    }
    toast.success(success ?? t.copied);
  } catch {
    toast.danger(t.copyFailed);
  }
}
