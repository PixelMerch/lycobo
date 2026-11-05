import { Button, Tooltip, toast } from "@heroui/react";
import type { ImageJob } from "@lycoboai/contracts";
import { IconDownload } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { prepareDownloadDeliveries, resolveDownloadDelivery } from "../download-deliveries";
import { historyDownloadEntries } from "./history-download";

async function readOriginal(id: string, remaining: number, signal: AbortSignal) {
  const delivery = await resolveDownloadDelivery(id, signal);
  const response = await fetch(delivery.download_url, {
    signal,
    credentials: "omit",
    referrerPolicy: "strict-origin-when-cross-origin",
  });
  if (!response.ok || !response.headers.get("Content-Type")?.startsWith("image/") || !response.body)
    throw new Error("图片下载失败，请稍后重试。");
  if (Number(response.headers.get("Content-Length")) > remaining)
    throw new Error("图片总大小过大，请分别下载。");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > remaining) throw new Error("图片总大小过大，请分别下载。");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  if (!size) throw new Error("图片下载失败，请稍后重试。");
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export function HistoryDownloadButton({ job }: { job: ImageJob }) {
  const entries = historyDownloadEntries(job);
  const [packing, setPacking] = useState(false);
  const [showCount, setShowCount] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  if (!entries.length) return null;
  const partial = entries.length < job.requested_count;
  const imageDownloadLabel = partial ? "下载已生成" : "下载全部";
  const downloadLabel = job.input?.variation ? "下载套图" : imageDownloadLabel;
  return (
    <Tooltip delay={0} closeDelay={0} isOpen={showCount && !packing} onOpenChange={setShowCount}>
      <Button
        variant="secondary"
        onHoverChange={setShowCount}
        onFocusChange={setShowCount}
        className="copy-prompt"
        isPending={packing}
        isDisabled={packing}
        onPress={async () => {
          if (active.current) return;
          const controller = new AbortController();
          active.current = controller;
          setPacking(true);
          const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(180000)]);
          try {
            const { createHistoryArchive } = await import("./history-download");
            await prepareDownloadDeliveries(
              entries.map((entry) => entry.id),
              signal,
            );
            const bytes = await createHistoryArchive(entries, readOriginal, signal);
            controller.signal.throwIfAborted();
            const url = URL.createObjectURL(
              new Blob([new Uint8Array(bytes)], { type: "application/zip" }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = `${job.input?.textileSet ? "家纺裂变" : "图片创作"}-${job.public_id ?? job.id}.zip`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 60000);
          } catch {
            if (!controller.signal.aborted) toast.danger("下载失败，请稍后重试或分别下载图片。");
          } finally {
            active.current = null;
            if (!controller.signal.aborted) setPacking(false);
          }
        }}
      >
        <UiIcon icon={IconDownload} size="small" />
        {packing ? "正在打包" : downloadLabel}
      </Button>
      <Tooltip.Content placement="bottom">{`共 ${entries.length} 张`}</Tooltip.Content>
    </Tooltip>
  );
}
