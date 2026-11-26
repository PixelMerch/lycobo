import { afterEach, expect, it, vi } from "vitest";
import { recoverUpdatedApp } from "./recover-updated-app";

const chunkError = new TypeError("Failed to fetch dynamically imported module");

function fixture(updatedEntry: string) {
  const fetchPage = vi.fn(
    async () =>
      new Response("<html></html>", {
        headers: { "Content-Type": "text/html" },
      }),
  );
  const reload = vi.fn();
  const entry = (src: string) => ({ querySelector: () => ({ getAttribute: () => src }) });
  const storage = new Map<string, string>();
  vi.stubGlobal("fetch", fetchPage);
  vi.stubGlobal("document", entry("/assets/index-old.js"));
  vi.stubGlobal("window", {
    location: { href: "https://example.com/zh-CN/dashboard?draft=1", reload },
  });
  vi.stubGlobal("sessionStorage", {
    getItem: storage.get.bind(storage),
    setItem: storage.set.bind(storage),
  });
  vi.stubGlobal(
    "DOMParser",
    class {
      parseFromString() {
        return entry(updatedEntry);
      }
    },
  );
  return { fetchPage, reload };
}

afterEach(() => vi.unstubAllGlobals());

it("reloads a newer app once after a stale route chunk fails", async () => {
  const { fetchPage, reload } = fixture("/assets/index-new.js");
  const { signal } = new AbortController();
  await recoverUpdatedApp(chunkError, signal);
  await recoverUpdatedApp(chunkError, signal);
  expect(fetchPage).toHaveBeenCalledOnce();
  expect(fetchPage).toHaveBeenCalledWith(
    "https://example.com/zh-CN/dashboard?draft=1",
    expect.objectContaining({ cache: "no-store" }),
  );
  expect(reload).toHaveBeenCalledOnce();
});

it("leaves the error page available for unchanged builds or unrelated errors", async () => {
  const { fetchPage, reload } = fixture("/assets/index-old.js");
  const { signal } = new AbortController();
  await recoverUpdatedApp(new Error("Fixture application error"), signal);
  expect(fetchPage).not.toHaveBeenCalled();
  await recoverUpdatedApp(chunkError, signal);
  expect(reload).not.toHaveBeenCalled();
});
