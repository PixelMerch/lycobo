import { currentMessages } from "../../i18n/messages";
import { resolveDownloadDelivery } from "./download-deliveries";
import { historyMessages } from "./history/history-messages";

/** 读到的一份原始文件：文件字节和响应声明的类型。 */
export type OriginalFile = { bytes: Uint8Array; type: string };

/** 把响应体读进内存，累计超过 remaining 字节就停下并报“太大”，不让浏览器内存失控。 */
async function readLimited(body: ReadableStream<Uint8Array>, remaining: number, tooLarge: string) {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > remaining) throw new Error(tooLarge);
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
  if (Number(response.headers.get("Content-Length")) > remaining) throw new Error(t.tooLarge);
  const bytes = await readLimited(response.body, remaining, t.tooLarge);
  if (!bytes.byteLength) throw new Error(t.downloadFailed);
  return { bytes, type };
}
