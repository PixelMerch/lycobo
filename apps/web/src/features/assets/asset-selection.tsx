import { Button, Toolbar, toast } from "@heroui/react";
import type { ImageAsset } from "@lycoboai/contracts";
import { IconDownload, IconListCheck, IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { UiIcon } from "../../components/ui-icon";
import { useMessages } from "../../i18n/messages";
import { downloadAsset } from "../generation/generation-client";
import { AssetArchiveTooLargeError, archiveStamp, createAssetArchive } from "./asset-archive";
import { assetsMessages } from "./assets-messages";

function toggled(current: ReadonlySet<string>, id: string) {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/**
 * 多选状态：是否在多选、选中了哪些素材。多选时按 Esc 退出；onSelectingChange 把多选开始或结束告诉外层，
 * 弹窗据此让 Esc 先退出多选，而不是直接关掉弹窗。
 */
export function useAssetSelection(onSelectingChange?: (selecting: boolean) => void) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    if (!selecting) return;
    // 弹层自己处理的 Esc（例如关闭筛选菜单）会停止冒泡，到不了这里。
    const exitOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelecting(false);
      setSelected(new Set());
      onSelectingChange?.(false);
    };
    window.addEventListener("keydown", exitOnEscape);
    return () => window.removeEventListener("keydown", exitOnEscape);
  }, [selecting, onSelectingChange]);
  const change = (next: boolean, ids: string[] = []) => {
    setSelecting(next);
    setSelected(new Set(ids));
    onSelectingChange?.(next);
  };
  return {
    selecting,
    selected,
    start: (id?: string) => change(true, id ? [id] : []),
    toggle: (id: string) => setSelected((current) => toggled(current, id)),
    selectAll: (ids: string[]) => setSelected(new Set(ids)),
    exit: () => change(false),
  };
}

/** 一组素材的多选状态与操作。 */
export type AssetSelection = ReturnType<typeof useAssetSelection>;

function saveArchive(bytes: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function packAndSave(assets: ImageAsset[], signal: AbortSignal, name: string) {
  const bytes = await createAssetArchive(assets, signal);
  signal.throwIfAborted();
  saveArchive(bytes, name);
}

/** 批量下载：选 1 项直接下载原文件，多项打包成 ZIP；离开页面时取消还在进行的打包。 */
function useSelectionDownload() {
  const t = useMessages(assetsMessages);
  const [packing, setPacking] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function pack(assets: ImageAsset[]) {
    const controller = new AbortController();
    active.current = controller;
    setPacking(true);
    // 一次最多打包 256MB，按慢速网络留出 5 分钟；超时与手动取消都不会产出半个压缩包。
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(300_000)]);
    try {
      await packAndSave(assets, signal, t.archiveName(archiveStamp()));
    } catch (error) {
      if (controller.signal.aborted) return;
      toast.danger(error instanceof AssetArchiveTooLargeError ? t.tooLarge : t.archiveFailed);
    } finally {
      active.current = null;
      if (!controller.signal.aborted) setPacking(false);
    }
  }
  function download(assets: ImageAsset[]) {
    const [first] = assets;
    if (!first || active.current) return;
    if (assets.length === 1) downloadAsset(first.id);
    else void pack(assets);
  }
  return { packing, download };
}

/** 多选时的操作条：已选数量、全选（只选已经加载出来的）、下载与退出多选。 */
function AssetSelectionBar({
  assets,
  selection,
}: {
  assets: ImageAsset[];
  selection: AssetSelection;
}) {
  const t = useMessages(assetsMessages);
  const { packing, download } = useSelectionDownload();
  const chosen = assets.filter((asset) => selection.selected.has(asset.id));
  return (
    <Toolbar aria-label={t.selection} className="asset-selection-bar">
      <span className="asset-selection-count" aria-live="polite">
        {t.selectedCount(chosen.length)}
      </span>
      <Button
        size="sm"
        variant="ghost"
        className="asset-selection-all"
        isDisabled={!assets.length || chosen.length === assets.length}
        onPress={() => selection.selectAll(assets.map((asset) => asset.id))}
      >
        {t.selectAll}
      </Button>
      <Button
        size="sm"
        variant="primary"
        className="asset-selection-download"
        isDisabled={!chosen.length}
        isPending={packing}
        onPress={() => download(chosen)}
      >
        <UiIcon icon={IconDownload} size="small" />
        {packing ? t.packing : t.downloadSelected(chosen.length)}
      </Button>
      <Button
        isIconOnly
        size="sm"
        variant="ghost"
        className="asset-selection-exit"
        aria-label={t.exitSelection}
        onPress={selection.exit}
      >
        <UiIcon icon={IconX} />
      </Button>
    </Toolbar>
  );
}

/** 筛选行末尾的“多选”入口；进入多选后换成操作条。 */
export function AssetSelectionControls({
  assets,
  selection,
}: {
  assets: ImageAsset[];
  selection: AssetSelection;
}) {
  const t = useMessages(assetsMessages);
  if (selection.selecting) return <AssetSelectionBar assets={assets} selection={selection} />;
  return (
    <Button
      size="sm"
      variant="ghost"
      className="asset-selection-start"
      isDisabled={!assets.length}
      onPress={() => selection.start()}
    >
      <UiIcon icon={IconListCheck} size="small" />
      {t.select}
    </Button>
  );
}
