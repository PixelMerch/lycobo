import { beforeEach, expect, it } from "vitest";
import { useFreeCanvasStore } from "./free-canvas-state";

const baseItem = {
  kind: "image" as const,
  x: 0,
  y: 0,
  width: 300,
  height: 300,
  rotation: 0,
};

beforeEach(() => {
  useFreeCanvasStore.setState({
    items: [],
    selectedId: null,
    tool: "select",
    zoom: 1,
    pan: { x: 0, y: 0 },
  });
});

it("adds an item, selects it and returns to the select tool", () => {
  useFreeCanvasStore.getState().selectTool("text");
  useFreeCanvasStore.getState().addItem({ ...baseItem, id: "a" });
  const state = useFreeCanvasStore.getState();
  expect(state.items).toHaveLength(1);
  expect(state.selectedId).toBe("a");
  expect(state.tool).toBe("select");
});

it("duplicates with an offset and removes the original independently", () => {
  useFreeCanvasStore.getState().addItem({ ...baseItem, id: "a" });
  useFreeCanvasStore.getState().duplicateItem("a");
  const items = useFreeCanvasStore.getState().items;
  expect(items).toHaveLength(2);
  expect(items[1]?.x).toBe(32);
  useFreeCanvasStore.getState().removeItem(items[1]?.id ?? "");
  expect(useFreeCanvasStore.getState().items).toHaveLength(1);
  expect(useFreeCanvasStore.getState().selectedId).toBeNull();
});

it("reorders layers without dropping items", () => {
  useFreeCanvasStore.getState().addItem({ ...baseItem, id: "a" });
  useFreeCanvasStore.getState().addItem({ ...baseItem, id: "b" });
  useFreeCanvasStore.getState().reorderItem("b", "backward");
  expect(useFreeCanvasStore.getState().items.map((item) => item.id)).toEqual(["b", "a"]);
  useFreeCanvasStore.getState().reorderItem("b", "backward");
  expect(useFreeCanvasStore.getState().items.map((item) => item.id)).toEqual(["b", "a"]);
});

it("clamps zoom to the supported range", () => {
  useFreeCanvasStore.getState().setZoom(12);
  expect(useFreeCanvasStore.getState().zoom).toBe(4);
  useFreeCanvasStore.getState().setZoom(0.01);
  expect(useFreeCanvasStore.getState().zoom).toBe(0.25);
});
