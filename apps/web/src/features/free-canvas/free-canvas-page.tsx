import { useEffect, useRef } from "react";
import { useMessages } from "../../i18n/messages";
import { freeCanvasMessages } from "./free-canvas-messages";
import { FreeCanvasPanel } from "./free-canvas-panel";
import { FreeCanvasStage } from "./free-canvas-stage";
import { type FreeCanvasItem, useFreeCanvasStore } from "./free-canvas-state";
import { readStoredItems, writeStoredItems } from "./free-canvas-storage";
import { FreeCanvasToolbar } from "./free-canvas-toolbar";
import "./free-canvas.css";

/** 新节点依次错开，避免连续添加时完全重叠。 */
function nextPosition(index: number) {
  const step = index % 6;
  return { x: 140 + step * 28, y: 130 + step * 28 };
}

/** 自由画布：素材、文字与模型生成图片在同一张画布上排版。 */
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

  const addLocalImage = () => fileInput.current?.click();

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
    <section aria-labelledby="free-canvas-title" className="free-canvas-page">
      <header className="free-canvas-header">
        <div>
          <h1 id="free-canvas-title">{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>
        <FreeCanvasToolbar
          fileInput={fileInput}
          onResetView={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          onTool={pickTool}
          onZoom={setZoom}
          tool={tool}
          zoom={zoom}
        />
      </header>

      <div className="free-canvas-body">
        <div className="free-canvas-workspace">
          <FreeCanvasStage
            items={items}
            onChange={(id, patch) => updateItem(id, patch)}
            onPan={setPan}
            onSelect={select}
            onZoom={setZoom}
            pan={pan}
            selectedId={selectedId}
            tool={tool}
            zoom={zoom}
          />
          {items.length === 0 && <p className="free-canvas-empty">{t.empty}</p>}
          <p className="free-canvas-hint">{t.selectHint}</p>
        </div>
        <FreeCanvasPanel
          onAddLocalImage={addLocalImage}
          onBackward={() => selectedId && reorderItem(selectedId, "backward")}
          onDuplicate={() => selectedId && duplicateItem(selectedId)}
          onForward={() => selectedId && reorderItem(selectedId, "forward")}
          onInsertImage={addItem}
          onRemove={() => selectedId && removeItem(selectedId)}
          onUpdate={(patch: Partial<Omit<FreeCanvasItem, "id">>) =>
            selectedId && updateItem(selectedId, patch)
          }
          selected={selected}
        />
      </div>
      <input
        ref={fileInput}
        accept="image/png,image/jpeg,image/webp"
        className="sr-only free-canvas-file"
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
