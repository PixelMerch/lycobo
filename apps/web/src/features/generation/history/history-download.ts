import type { ImageJob } from "@lycoboai/contracts";
import type { Locale } from "../../../i18n/locale";
import { currentMessages } from "../../../i18n/messages";
import { textileViewMessages } from "../../commerce/textile-set/textile-view-messages";
import { downloadOriginals, type OriginalChunkObserver } from "../original-download";
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

type ArchiveEntries = ReturnType<typeof historyDownloadEntries>;
type ReadOriginal = (
  id: string,
  remainingBytes: number,
  signal: AbortSignal,
  onChunk: OriginalChunkObserver,
) => Promise<Uint8Array>;
type ArchiveFeedback = {
  onProgress: (fraction: number) => void;
  onPacking: () => void | Promise<void>;
};

/** 并发读取原图，共用大小上限，全部成功后按原顺序无损打包。 */
export async function createHistoryArchive(
  entries: ArchiveEntries,
  readOriginal: ReadOriginal,
  signal: AbortSignal,
  feedback?: ArchiveFeedback,
) {
  if (!entries.length) throw new Error(currentMessages(historyMessages).nothingToDownload);
  let totalProgress = 0;
  const progress = entries.map(() => 0);
  const originals = await downloadOriginals(
    entries,
    async (...args) => ({ bytes: await readOriginal(...args) }),
    signal,
    (index, fraction) => {
      totalProgress += fraction - (progress[index] ?? 0);
      progress[index] = fraction;
      feedback?.onProgress(Math.min(totalProgress / entries.length, 1));
    },
  );
  feedback?.onProgress(1);
  signal.throwIfAborted();
  await feedback?.onPacking();
  signal.throwIfAborted();
  // PNG 本身已压缩，直接存入可保留原始字节，也省去重复压缩。
  const { zipSync } = await import("fflate");
  signal.throwIfAborted();
  const files = Object.fromEntries(originals.map(({ entry, file }) => [entry.name, file.bytes]));
  return zipSync(files, { level: 0 });
}
