import { create } from "zustand";

export type FreeCanvasTool = "select" | "hand" | "text" | "note";
export type FreeCanvasItemKind = "image" | "text" | "note";

export type FreeCanvasPoint = { x: number; y: number };

export type FreeCanvasItem = {
  id: string;
  kind: FreeCanvasItemKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  src?: string;
  text?: string;
  fill?: string;
  fontSize?: number;
};

type FreeCanvasState = {
  items: FreeCanvasItem[];
  selectedId: string | null;
  tool: FreeCanvasTool;
  zoom: number;
  pan: FreeCanvasPoint;
  selected: (id: string | null) => void;
  selectTool: (tool: FreeCanvasTool) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: FreeCanvasPoint) => void;
  addItem: (item: FreeCanvasItem) => void;
  updateItem: (id: string, patch: Partial<Omit<FreeCanvasItem, "id">>) => void;
  duplicateItem: (id: string) => void;
  removeItem: (id: string) => void;
  reorderItem: (id: string, direction: "forward" | "backward") => void;
};

/** 自由画布只保存当前页面的编辑状态；生成素材和上传素材由服务端持久化。 */
export const useFreeCanvasStore = create<FreeCanvasState>((set, get) => ({
  items: [],
  selectedId: null,
  tool: "select",
  zoom: 1,
  pan: { x: 0, y: 0 },
  selected: (selectedId) => set({ selectedId }),
  selectTool: (tool) => set({ tool, selectedId: tool === "select" ? get().selectedId : null }),
  setZoom: (zoom) => set({ zoom: Math.min(4, Math.max(0.25, zoom)) }),
  setPan: (pan) => set({ pan }),
  addItem: (item) =>
    set((state) => ({ items: [...state.items, item], selectedId: item.id, tool: "select" })),
  updateItem: (id, patch) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })),
  duplicateItem: (id) =>
    set((state) => {
      const original = state.items.find((item) => item.id === id);
      if (!original) return state;
      const clone = {
        ...original,
        id: crypto.randomUUID(),
        x: original.x + 32,
        y: original.y + 32,
      };
      return { items: [...state.items, clone], selectedId: clone.id, tool: "select" };
    }),
  removeItem: (id) =>
    set((state) => ({ items: state.items.filter((item) => item.id !== id), selectedId: null })),
  reorderItem: (id, direction) =>
    set((state) => {
      const index = state.items.findIndex((item) => item.id === id);
      const nextIndex = direction === "forward" ? index + 1 : index - 1;
      if (index < 0 || nextIndex < 0 || nextIndex >= state.items.length) return state;
      const items = [...state.items];
      const [current] = items.splice(index, 1);
      if (!current) return state;
      items.splice(nextIndex, 0, current);
      return { items };
    }),
}));
