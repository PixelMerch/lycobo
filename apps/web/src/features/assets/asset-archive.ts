import type { ImageAsset } from "@lycoboai/contracts";
import { prepareDownloadDeliveries } from "../generation/download-deliveries";
import { type OriginalFile, readOriginal } from "../generation/original-download";

/** 批量下载的打包上限：压缩包在浏览器内存里拼，与生成记录的整组下载一样是 256MB。 */
export const assetArchiveLimit = 256 * 1024 * 1024;

/** 选中素材的总大小超过打包上限，需要分批下载。 */
export class AssetArchiveTooLargeError extends Error {}

const extensions: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

/** 压缩包里的文件名：按选择顺序编号，加素材 ID，扩展名按下载到的真实类型。 */
export function assetArchiveEntryName(index: number, asset: ImageAsset, type: string) {
  const mime = type.split(";")[0]?.trim().toLowerCase() ?? "";
  const extension = extensions[mime] ?? (asset.type === "video" ? "mp4" : "png");
  return `${String(index + 1).padStart(2, "0")}-${asset.public_id ?? asset.id}.${extension}`;
}

/** 压缩包文件名里的时间：本地时间的年月日-时分，例如 20261110-1432。 */
export function archiveStamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  return `${day}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

type ReadFile = (id: string, remaining: number, signal: AbortSignal) => Promise<OriginalFile>;

const readImageOrVideo: ReadFile = (id, remaining, signal) =>
  readOriginal(id, remaining, signal, ["image/", "video/"]);

/**
 * 依次下载选中素材的原始文件并打包成 ZIP。先按素材记录的大小检查上限，超过就不开始下载；
 * 下载中途累计超过上限同样停止，不会产出缺文件的压缩包。
 */
export async function createAssetArchive(
  assets: readonly ImageAsset[],
  signal: AbortSignal,
  read: ReadFile = readImageOrVideo,
  prepare: (ids: string[], signal: AbortSignal) => Promise<void> = prepareDownloadDeliveries,
) {
  const total = assets.reduce((sum, asset) => sum + asset.bytes, 0);
  if (total > assetArchiveLimit) throw new AssetArchiveTooLargeError();
  await prepare(
    assets.map((asset) => asset.id),
    signal,
  );
  const files: Record<string, Uint8Array> = {};
  let remaining = assetArchiveLimit;
  for (const [index, asset] of assets.entries()) {
    signal.throwIfAborted();
    const file = await read(asset.id, remaining, signal);
    remaining -= file.bytes.byteLength;
    files[assetArchiveEntryName(index, asset, file.type)] = file.bytes;
  }
  // 图片和视频本身已经压缩过，直接存入可保留原始字节，也省去重复压缩。
  const { zipSync } = await import("fflate");
  signal.throwIfAborted();
  return zipSync(files, { level: 0 });
}
