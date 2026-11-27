import { Button, Tooltip } from "@heroui/react";
import { type ImageJob, imageJobTool } from "@lycoboai/contracts";
import { IconDownload } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { toast } from "../../../lib/toast";
import { prepareDownloadDeliveries } from "../download-deliveries";
import { type OriginalChunkObserver, readOriginal } from "../original-download";
import { createHistoryArchive, historyDownloadEntries } from "./history-download";
import { historyMessages } from "./history-messages";
import "./history-download-button.css";

/** 整组下载只收图片，读取规则与素材库批量下载共用。 */
const readOriginalImage = async (
  id: string,
  remaining: number,
  signal: AbortSignal,
  onChunk: OriginalChunkObserver,
) => (await readOriginal(id, remaining, signal, undefined, onChunk)).bytes;

/** 整组下载时显示原图接收进度，收齐后再切换打包状态。 */
export function HistoryDownloadButton({ job }: { job: ImageJob }) {
  const t = useMessages(historyMessages);
  const entries = historyDownloadEntries(job, useLocale());
  const [phase, setPhase] = useState<"idle" | "downloading" | "packing">("idle");
  const [progress, setProgress] = useState(0);
  const [showCount, setShowCount] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  if (!entries.length) return null;
  const partial = entries.length < job.requested_count;
  const imageDownloadLabel = partial ? t.downloadGenerated : t.downloadAll;
  const downloadLabel = imageJobTool(job) === "variation" ? t.downloadSet : imageDownloadLabel;
  const label = { idle: downloadLabel, downloading: t.downloading, packing: t.packing }[phase];
  const busy = phase !== "idle";

  async function download() {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setProgress(0);
    setPhase("downloading");
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(180000)]);
    try {
      await prepareDownloadDeliveries(
        entries.map((entry) => entry.id),
        signal,
      );
      const bytes = await createHistoryArchive(entries, readOriginalImage, signal, {
        // 按进度变化更新按钮，避免每个网络数据块都触发渲染。
        onProgress: (fraction) => setProgress(Math.floor(fraction * 100) / 100),
        onPacking: async () => {
          setProgress(1);
          setPhase("packing");
          // 先绘制填满的进度和打包文字，再进行同步 ZIP 组装。
          await new Promise<void>((resolve) => setTimeout(resolve, 160));
        },
      });
      signal.throwIfAborted();
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = t.archiveName(!!job.input?.textileSet, job.public_id ?? job.id);
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      if (!controller.signal.aborted) toast.danger(t.archiveFailed);
    } finally {
      active.current = null;
      if (!controller.signal.aborted) setPhase("idle");
    }
  }

  return (
    <>
      <Tooltip delay={0} closeDelay={0} isOpen={showCount && !busy} onOpenChange={setShowCount}>
        <Button
          variant="secondary"
          onHoverChange={setShowCount}
          onFocusChange={setShowCount}
          className="copy-prompt history-download"
          data-phase={phase}
          isPending={busy}
          onPress={download}
        >
          <span
            aria-hidden="true"
            className="history-download-fill"
            style={{ transform: `scaleX(${busy ? progress : 0})` }}
          />
          <span className="history-download-content">
            <UiIcon icon={IconDownload} size="small" />
            {label}
          </span>
        </Button>
        <Tooltip.Content placement="bottom">{t.imageTotal(entries.length)}</Tooltip.Content>
      </Tooltip>
      {phase === "downloading" && (
        <span
          className="sr-only"
          role="progressbar"
          aria-label={t.downloadingOriginals}
          aria-valuenow={Math.round(progress * 100)}
        />
      )}
      <span className="sr-only" role="status">
        {busy ? label : ""}
      </span>
    </>
  );
}
