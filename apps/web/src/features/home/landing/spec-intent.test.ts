import { afterEach, expect, it, vi } from "vitest";
import { clearSpec, readSpec, rememberSpec, takeSpec } from "./spec-intent";

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
  vi.useRealTimers();
});

it("keeps a valid Create spec until it is taken", () => {
  vi.stubGlobal("sessionStorage", memoryStorage());
  rememberSpec({ ratio: "3:4", resolution: "2K" });
  expect(readSpec()).toEqual({ ratio: "3:4", resolution: "2K" });
  expect(takeSpec()).toEqual({ ratio: "3:4", resolution: "2K" });
  expect(readSpec()).toBeNull();
});

it("ignores specs that are no longer supported or have expired", () => {
  const storage = memoryStorage();
  vi.stubGlobal("sessionStorage", storage);
  storage.setItem(
    "lycobo:commerce:spec",
    JSON.stringify({ ratio: "4:5", resolution: "2K", at: Date.now() }),
  );
  expect(readSpec()).toBeNull();

  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-14T10:00:00Z"));
  rememberSpec({ ratio: "1:1", resolution: "1.5K" });
  vi.setSystemTime(new Date("2026-11-14T11:00:00Z"));
  expect(readSpec()).toBeNull();
});

it("clears a spec only when the flow has consumed it", () => {
  vi.stubGlobal("sessionStorage", memoryStorage());
  rememberSpec({ ratio: "9:16", resolution: "4K" });
  clearSpec();
  expect(readSpec()).toBeNull();
});
