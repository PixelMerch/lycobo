import { type ImageJob, textileViews } from "@lycoboai/contracts";

export function historyDownloadEntries(job: ImageJob) {
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
      const label = textileViews.find((entry) => entry.id === view)?.name ?? "生成图片";
      return [
        {
          id: item.output_asset_id,
          name: `${String(item.position + 1).padStart(2, "0")}-${label}.png`,
        },
      ];
    });
}

/** Download sequentially and keep an explicit memory bound for browser ZIP creation. */
export async function createHistoryArchive(
  entries: ReturnType<typeof historyDownloadEntries>,
  readOriginal: (id: string, remainingBytes: number, signal: AbortSignal) => Promise<Uint8Array>,
  signal: AbortSignal,
) {
  if (!entries.length) throw new Error("暂无可下载的图片。");
  const files: Record<string, Uint8Array> = {};
  let remaining = 256 * 1024 * 1024;
  for (const entry of entries) {
    signal.throwIfAborted();
    const bytes = await readOriginal(entry.id, remaining, signal);
    remaining -= bytes.byteLength;
    if (remaining < 0) throw new Error("图片总大小过大，请分别下载。");
    files[entry.name] = bytes;
  }
  signal.throwIfAborted();
  // PNGs are already compressed; storing them preserves bytes without recompression work.
  const { zipSync } = await import("fflate");
  signal.throwIfAborted();
  return zipSync(files, { level: 0 });
}
