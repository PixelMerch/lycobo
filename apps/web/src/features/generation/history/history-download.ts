import type { ImageJob } from "@lycoboai/contracts";
import type { Locale } from "../../../i18n/locale";
import { currentMessages } from "../../../i18n/messages";
import { textileViewMessages } from "../../commerce/textile-set/textile-view-messages";
import { historyMessages } from "./history-messages";

/** 可整组下载的成功图片与文件名；文件名按序号加视角名称，用当前界面语言。 */
export function historyDownloadEntries(job: ImageJob, locale: Locale) {
  if (
    job.requested_count < 2 ||
    ["queued", "running"].includes(job.status) ||
    job.items.some((item) => ["queued", "running"].includes(item.status))
  )
    return [];
  return [...job.items]
    .sort((a, b) => a.position - b.position)
    .flatMap((item) => {
      if (item.status !== "succeeded" || !item.output_asset_id) return [];
      const view = job.input?.textileSet?.views[item.position];
      const label = view
        ? textileViewMessages[locale][view]
        : historyMessages[locale].generatedImage;
      return [
        {
          id: item.output_asset_id,
          name: `${String(item.position + 1).padStart(2, "0")}-${label}.png`,
        },
      ];
    });
}

/** 依次下载原图并打包成 ZIP，限制总大小避免浏览器内存过高。 */
export async function createHistoryArchive(
  entries: ReturnType<typeof historyDownloadEntries>,
  readOriginal: (id: string, remainingBytes: number, signal: AbortSignal) => Promise<Uint8Array>,
  signal: AbortSignal,
) {
  if (!entries.length) throw new Error(currentMessages(historyMessages).nothingToDownload);
  const files: Record<string, Uint8Array> = {};
  let remaining = 256 * 1024 * 1024;
  for (const entry of entries) {
    signal.throwIfAborted();
    const bytes = await readOriginal(entry.id, remaining, signal);
    remaining -= bytes.byteLength;
    if (remaining < 0) throw new Error(currentMessages(historyMessages).tooLarge);
    files[entry.name] = bytes;
  }
  signal.throwIfAborted();
  // PNG 本身已压缩，直接存入可保留原始字节，也省去重复压缩。
  const { zipSync } = await import("fflate");
  signal.throwIfAborted();
  return zipSync(files, { level: 0 });
}
