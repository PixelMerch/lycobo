import { Button, ToggleButton, ToggleButtonGroup, Tooltip } from "@heroui/react";
import { IconMinus, IconPlus } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { UiIcon } from "../../components/ui-icon";
import { useMessages } from "../../i18n/messages";
import { freeCanvasMessages } from "./free-canvas-messages";
import { FreeCanvasComposer, FreeCanvasInspector } from "./free-canvas-panel";
import { FreeCanvasStage } from "./free-canvas-stage";
import { type FreeCanvasItem, useFreeCanvasStore } from "./free-canvas-state";
import { readStoredItems, writeStoredItems } from "./free-canvas-storage";
import { FreeCanvasToolbar } from "./free-canvas-toolbar";
import "./free-canvas.css";
import "./free-canvas-dock.css";

type CanvasFilter = "all" | "image" | "text" | "note";

/** 新节点放在创作卡右侧并依次错开，避免被浮动卡遮住或互相完全重叠。 */
function nextPosition(index: number) {
  const step = index % 6;
  return { x: 420 + step * 28, y: 120 + step * 28 };
}

const filterKinds: CanvasFilter[] = ["all", "image", "text", "note"];

/** 顶部筛选条：分类筛选、上传与缩放。 */
function FreeCanvasTopBar({
  filter,
  zoom,
  onFilter,
  onUpload,
  onZoom,
  onResetView,
}: {
  filter: CanvasFilter;
  zoom: number;
  onFilter: (filter: CanvasFilter) => void;
  onUpload: () => void;
  onZoom: (zoom: number) => void;
  onResetView: () => void;
}) {
  const t = useMessages(freeCanvasMessages);
  const labels: Record<CanvasFilter, string> = {
    all: t.filterAll,
    image: t.filterImages,
    text: t.filterText,
    note: t.filterNotes,
  };
  return (
    <div className="fc-topbar">
      <ToggleButtonGroup
        aria-label={t.filterLabel}
        className="fc-filters"
        disallowEmptySelection
        isDetached
        selectedKeys={[filter]}
        selectionMode="single"
        onSelectionChange={(keys) => {
          const [next] = keys;
          if (next === "all" || next === "image" || next === "text" || next === "note")
            onFilter(next);
        }}
      >
        {filterKinds.map((kind) => (
          <ToggleButton id={kind} key={kind}>
            {labels[kind]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Button className="fc-upload" onPress={onUpload}>
        {t.upload}
      </Button>
      <div className="fc-zoom">
        <Tooltip delay={200}>
          <Button
            isIconOnly
            aria-label={t.zoomOut}
            className="fc-zoom-button"
            onPress={() => onZoom(zoom - 0.1)}
          >
            <UiIcon icon={IconMinus} size="small" />
          </Button>
          <Tooltip.Content placement="bottom">{t.zoomOut}</Tooltip.Content>
        </Tooltip>
        <output aria-label={t.zoomLevel} className="fc-zoom-value">
          {Math.round(zoom * 100)}%
        </output>
        <Tooltip delay={200}>
          <Button
            isIconOnly
            aria-label={t.zoomIn}
            className="fc-zoom-button"
            onPress={() => onZoom(zoom + 0.1)}
          >
            <UiIcon icon={IconPlus} size="small" />
          </Button>
          <Tooltip.Content placement="bottom">{t.zoomIn}</Tooltip.Content>
        </Tooltip>
        <Button className="fc-zoom-reset" onPress={onResetView}>
          {t.zoomReset}
        </Button>
      </div>
    </div>
  );
}

/** 自由画布：素材、文字与模型生成图片在同一张深色画布上排版。 */
export function FreeCanvasPage() {
  const t = useMessages(freeCanvasMessages);
  const fileInput = useRef<HTMLInputElement>(null);
  const items = useFreeCanvasStore((state) => state.items);
  const selectedId = useFreeCanvasStore((state) => state.selectedId);
  const tool = useFreeCanvasStore((state) => state.tool);
  const zoom = useFreeCanvasStore((state) => state.zoom);
  const pan = useFreeCanvasStore((state) => state.pan);
  const select = useFreeCanvasStore((state) => state.selected);
  const selectTool = useFreeCanvasStore((state) => state.selectTool);
  const setZoom = useFreeCanvasStore((state) => state.setZoom);
  const setPan = useFreeCanvasStore((state) => state.setPan);
  const addItem = useFreeCanvasStore((state) => state.addItem);
  const updateItem = useFreeCanvasStore((state) => state.updateItem);
  const duplicateItem = useFreeCanvasStore((state) => state.duplicateItem);
  const removeItem = useFreeCanvasStore((state) => state.removeItem);
  const reorderItem = useFreeCanvasStore((state) => state.reorderItem);
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const [filter, setFilter] = useState<CanvasFilter>("all");
  const visible = filter === "all" ? items : items.filter((item) => item.kind === filter);

  // 画布内容和本地图片地址都只保存在本机浏览器。
  useEffect(() => {
    const stored = readStoredItems();
    if (stored.length) useFreeCanvasStore.setState({ items: stored });
  }, []);

  useEffect(() => writeStoredItems(items), [items]);

  const pickTool = (next: string) => {
    if (next === "select" || next === "hand") {
      selectTool(next);
      return;
    }
    if (next === "text" || next === "note") {
      const note = next === "note";
      addItem({
        id: crypto.randomUUID(),
        kind: next,
        ...nextPosition(items.length),
        width: note ? 240 : 320,
        height: note ? 180 : 60,
        rotation: 0,
        text: "",
        fontSize: note ? 15 : 28,
      });
    }
  };

  const changeFilter = (next: CanvasFilter) => {
    setFilter(next);
    // 被筛掉的节点不能保持选中，否则检查器会指向看不到的内容。
    if (selected && next !== "all" && selected.kind !== next) select(null);
  };

  const addFile = (file: File) => {
    addItem({
      id: crypto.randomUUID(),
      kind: "image",
      src: URL.createObjectURL(file),
      ...nextPosition(items.length),
      width: 420,
      height: 420,
      rotation: 0,
    });
  };

  return (
    <section aria-labelledby="free-canvas-title" className="fc-page">
      <h1 className="sr-only" id="free-canvas-title">
        {t.title}
      </h1>
      <FreeCanvasTopBar
        filter={filter}
        onFilter={changeFilter}
        onResetView={() => {
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }}
        onUpload={() => fileInput.current?.click()}
        onZoom={setZoom}
        zoom={zoom}
      />

      <div className="fc-canvas">
        <FreeCanvasStage
          items={visible}
          onChange={(id, patch) => updateItem(id, patch)}
          onPan={setPan}
          onSelect={select}
          onZoom={setZoom}
          pan={pan}
          selectedId={selectedId}
          tool={tool}
          zoom={zoom}
        />
        {visible.length === 0 && (
          <p className="fc-empty">{items.length === 0 ? t.emptyCanvas : t.emptyFiltered}</p>
        )}
        <p className="fc-hint">{t.selectHint}</p>
      </div>

      <FreeCanvasComposer onInsertImage={addItem} />
      {selected && (
        <FreeCanvasInspector
          onBackward={() => reorderItem(selected.id, "backward")}
          onDuplicate={() => duplicateItem(selected.id)}
          onForward={() => reorderItem(selected.id, "forward")}
          onRemove={() => removeItem(selected.id)}
          onUpdate={(patch: Partial<Omit<FreeCanvasItem, "id">>) => updateItem(selected.id, patch)}
          selected={selected}
        />
      )}
      <FreeCanvasToolbar fileInput={fileInput} onTool={pickTool} tool={tool} />
      <input
        ref={fileInput}
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) addFile(file);
        }}
      />
    </section>
  );
}
