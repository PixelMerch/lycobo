import { afterEach, expect, it, vi } from "vitest";
import { readStoredItems, writeStoredItems } from "./free-canvas-storage";

function memoryStorage() {
  const memory = new Map<string, string>();
  return {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

it("round-trips saved items and keeps text and image fields", () => {
  vi.stubGlobal("localStorage", memoryStorage());
  writeStoredItems([
    { id: "a", kind: "image", x: 1, y: 2, width: 300, height: 200, rotation: 0, src: "blob:x" },
    { id: "b", kind: "note", x: 0, y: 0, width: 240, height: 180, rotation: 12, text: "备注" },
  ]);
  expect(readStoredItems()).toEqual([
    { id: "a", kind: "image", x: 1, y: 2, width: 300, height: 200, rotation: 0, src: "blob:x" },
    { id: "b", kind: "note", x: 0, y: 0, width: 240, height: 180, rotation: 12, text: "备注" },
  ]);
});

it("drops malformed entries and unknown kinds instead of failing the page", () => {
  const storage = memoryStorage();
  vi.stubGlobal("localStorage", storage);
  storage.setItem(
    "lycobo:free-canvas:items",
    JSON.stringify([
      { id: "ok", kind: "text", x: 0, y: 0, width: 200, height: 60, rotation: 0 },
      { id: "bad-kind", kind: "video", x: 0, y: 0, width: 1, height: 1, rotation: 0 },
      { id: 12, kind: "text" },
      "nope",
    ]),
  );
  expect(readStoredItems()).toEqual([
    { id: "ok", kind: "text", x: 0, y: 0, width: 200, height: 60, rotation: 0 },
  ]);
});

it("returns an empty canvas when storage holds invalid JSON", () => {
  const storage = memoryStorage();
  vi.stubGlobal("localStorage", storage);
  storage.setItem("lycobo:free-canvas:items", "{not json");
  expect(readStoredItems()).toEqual([]);
});
