import { currentMessages } from "../../i18n/messages";
import { resolveDownloadDelivery } from "./download-deliveries";
import { historyMessages } from "./history/history-messages";

/** 读到的一份原始文件：文件字节和响应声明的类型。 */
export type OriginalFile = { bytes: Uint8Array; type: string };

/** 每块读到的字节数，以及响应声明的总字节数。未知大小时总数为零。 */
export type OriginalChunkObserver = (bytes: number, total: number) => void;

/** 原图打包在浏览器内存中，所有并发响应共用这个大小上限。 */
export const originalArchiveByteLimit = 256 * 1024 * 1024;

/** 所选原图的大小超过浏览器打包预算。 */
export class OriginalDownloadTooLargeError extends Error {
  constructor() {
    super(currentMessages(historyMessages).tooLarge);
  }
}

type ReadOriginalFile<T extends { bytes: Uint8Array }> = (
  id: string,
  remaining: number,
  signal: AbortSignal,
  onChunk: OriginalChunkObserver,
) => Promise<T>;

/** 固定三路读取，实时累计所有响应的字节。单个读取失败时取消同批请求。 */
export async function downloadOriginals<
  Entry extends { id: string },
  T extends { bytes: Uint8Array },
>(
  entries: readonly Entry[],
  read: ReadOriginalFile<T>,
  signal: AbortSignal,
  onProgress?: (index: number, fraction: number) => void,
) {
  const controller = new AbortController();
  const readingSignal = AbortSignal.any([signal, controller.signal]);
  const queue = entries.entries();
  const originals: { entry: Entry; file: T }[] = [];
  let remaining = originalArchiveByteLimit;
  const consume = (bytes: number) => {
    remaining -= bytes;
    if (remaining < 0) throw new OriginalDownloadTooLargeError();
  };
  const worker = async () => {
    for (const [index, entry] of queue) {
      readingSignal.throwIfAborted();
      let received = 0;
      const file = await read(entry.id, remaining, readingSignal, (chunk, total) => {
        readingSignal.throwIfAborted();
        consume(chunk);
        received += chunk;
        // 总大小未知时，等读完整张原图再推进进度。
        if (total > 0) onProgress?.(index, Math.min(received / total, 0.99));
      });
      readingSignal.throwIfAborted();
      consume(file.bytes.byteLength - received);
      originals[index] = { entry, file };
      onProgress?.(index, 1);
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(3, entries.length) }, worker));
  } catch (error) {
    controller.abort(error);
    throw error;
  }
  return originals;
}

/** 把响应体读进内存，累计超过 remaining 字节就停下并报“太大”，不让浏览器内存失控。 */
async function readLimited(
  body: ReadableStream<Uint8Array>,
  remaining: number,
  contentLength: number,
  onChunk?: OriginalChunkObserver,
) {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > remaining) throw new OriginalDownloadTooLargeError();
      onChunk?.(value.byteLength, contentLength);
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/**
 * 通过签名下载链接读取一份原图（或视频），最多读 remaining 字节。只接受 accept 列出的类型前缀，
 * 避免把出错页面当成图片打进压缩包；生成记录的整组下载和素材库的批量下载共用。
 */
export async function readOriginal(
  id: string,
  remaining: number,
  signal: AbortSignal,
  accept: readonly string[] = ["image/"],
  onChunk?: OriginalChunkObserver,
): Promise<OriginalFile> {
  const delivery = await resolveDownloadDelivery(id, signal);
  const response = await fetch(delivery.download_url, {
    signal,
    credentials: "omit",
    referrerPolicy: "strict-origin-when-cross-origin",
  });
  const t = currentMessages(historyMessages);
  const type = response.headers.get("Content-Type") ?? "";
  if (!response.ok || !accept.some((prefix) => type.startsWith(prefix)) || !response.body)
    throw new Error(t.downloadFailed);
  const contentLength = Number(response.headers.get("Content-Length")) || 0;
  if (contentLength > remaining) {
    await response.body.cancel().catch(() => undefined);
    throw new OriginalDownloadTooLargeError();
  }
  const bytes = await readLimited(response.body, remaining, contentLength, onChunk);
  if (!bytes.byteLength) throw new Error(t.downloadFailed);
  return { bytes, type };
}
