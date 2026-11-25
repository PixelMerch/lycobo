import type { ImageJob } from "@lycoboai/contracts";
import type { Locale } from "../../../i18n/locale";
import { currentMessages } from "../../../i18n/messages";
import { textileViewMessages } from "../../commerce/textile-set/textile-view-messages";
import type { OriginalChunkObserver } from "../original-download";
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

const downloadConcurrency = 3;
const archiveByteLimit = 256 * 1024 * 1024;

/** 并发读取原图，共用大小上限，全部成功后按原顺序无损打包。 */
export async function createHistoryArchive(
  entries: ArchiveEntries,
  readOriginal: ReadOriginal,
  signal: AbortSignal,
  feedback?: ArchiveFeedback,
) {
  if (!entries.length) throw new Error(currentMessages(historyMessages).nothingToDownload);
  const originals = await downloadOriginals(entries, readOriginal, signal, feedback?.onProgress);
  signal.throwIfAborted();
  await feedback?.onPacking();
  signal.throwIfAborted();
  // PNG 本身已压缩，直接存入可保留原始字节，也省去重复压缩。
  const { zipSync } = await import("fflate");
  signal.throwIfAborted();
  return zipSync(Object.fromEntries(originals), { level: 0 });
}

async function downloadOriginals(
  entries: ArchiveEntries,
  readOriginal: ReadOriginal,
  signal: AbortSignal,
  onProgress?: ArchiveFeedback["onProgress"],
) {
  const controller = new AbortController();
  const readingSignal = AbortSignal.any([signal, controller.signal]);
  const queue = entries.entries();
  const originals: [string, Uint8Array][] = [];
  let remaining = archiveByteLimit;
  let totalProgress = 0;
  const consume = (bytes: number) => {
    remaining -= bytes;
    if (remaining < 0) throw new Error(currentMessages(historyMessages).tooLarge);
  };
  const worker = async () => {
    for (const [index, entry] of queue) {
      readingSignal.throwIfAborted();
      let received = 0;
      let fraction = 0;
      const setFraction = (next: number) => {
        totalProgress += next - fraction;
        fraction = next;
        onProgress?.(Math.min(totalProgress / entries.length, 1));
      };
      const bytes = await readOriginal(entry.id, remaining, readingSignal, (chunk, total) => {
        readingSignal.throwIfAborted();
        consume(chunk);
        received += chunk;
        // 总大小未知时，等读完整张原图再推进这张图的进度。
        if (total > 0) setFraction(Math.min(received / total, 0.99));
      });
      readingSignal.throwIfAborted();
      consume(bytes.byteLength - received);
      originals[index] = [entry.name, bytes];
      setFraction(1);
    }
  };
  try {
    await Promise.all(
      Array.from({ length: Math.min(downloadConcurrency, entries.length) }, worker),
    );
  } catch (error) {
    controller.abort(error);
    throw error;
  }
  onProgress?.(1);
  return originals;
}
