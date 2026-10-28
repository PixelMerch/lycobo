import { Button, toast } from "@heroui/react";
import { type ImageJob, imageDeliverySchema } from "@lycoboai/contracts";
import { IconDownload } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { imageRequest } from "../generation-client";
import { historyDownloadEntries } from "./history-download";

async function readOriginal(id: string, remaining: number, signal: AbortSignal) {
  const metadata: unknown = await (
    await imageRequest(`image-assets/${id}/delivery`, { signal })
  ).json();
  const delivery = imageDeliverySchema.parse(
    metadata && typeof metadata === "object" && "delivery" in metadata ? metadata.delivery : null,
  );
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
    await reader.cancel().catch(() => {});
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
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  if (!entries.length) return null;
  const partial = entries.length < job.requested_count;
  return (
    <Button
      variant="secondary"
      className="copy-prompt"
      isPending={packing}
      isDisabled={packing}
      onPress={async () => {
        if (active.current) return;
        const controller = new AbortController();
        active.current = controller;
        setPacking(true);
        try {
          const { createHistoryArchive } = await import("./history-download");
          const bytes = await createHistoryArchive(
            entries,
            readOriginal,
            AbortSignal.any([controller.signal, AbortSignal.timeout(180000)]),
          );
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
      {packing ? "正在打包" : `${partial ? "下载已生成" : "下载全部"} · ${entries.length} 张`}
    </Button>
  );
}
