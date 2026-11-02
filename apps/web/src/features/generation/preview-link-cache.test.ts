import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { queryClient } from "../../lib/query-client";
import { clearPreviewLinks, reusePreviewLinks } from "./preview-link-cache";

beforeEach(() =>
  vi.stubGlobal("sessionStorage", {
    getItem(key: string) {
      return Reflect.get(this, key) ?? null;
    },
    setItem(key: string, value: string) {
      Reflect.set(this, key, value);
    },
    removeItem(key: string) {
      Reflect.deleteProperty(this, key);
    },
  }),
);
afterEach(() => {
  queryClient.clear();
  vi.unstubAllGlobals();
});
const scope = { organizationId: crypto.randomUUID(), userId: crypto.randomUUID() };
const delivery = (version: string) => ({
  url: `https://assets.example.test/one.preview.webp?sig=${version}`,
  thumbnail_url: `https://assets.example.test/one.thumbnail.webp?sig=${version}`,
  download_url: `https://assets.example.test/one.png?sig=${version}`,
  expires_at: Math.floor(Date.now() / 1000) + 86400,
});
it("reuses previews across a reload only after authorized metadata and keeps new download links", () => {
  queryClient.setQueryData(["image-session"], scope);
  reusePreviewLinks("one", delivery("old"));
  queryClient.clear();
  expect(reusePreviewLinks("one", delivery("new"))).toEqual(delivery("new"));
  queryClient.setQueryData(["image-session"], scope);
  const result = reusePreviewLinks("one", delivery("new"));
  expect(result.url).toBe(delivery("old").url);
  expect(result.download_url).toBe(delivery("new").download_url);
  queryClient.setQueryData(["image-session"], { ...scope, userId: crypto.randomUUID() });
  expect(reusePreviewLinks("one", delivery("new"))).toEqual(delivery("new"));
  queryClient.setQueryData(["image-session"], scope);
  clearPreviewLinks();
  expect(reusePreviewLinks("one", delivery("new"))).toEqual(delivery("new"));
});
it("replaces expired or relocated previews and tolerates unavailable storage", () => {
  queryClient.setQueryData(["image-session"], scope);
  reusePreviewLinks("one", { ...delivery("old"), expires_at: 1 });
  expect(reusePreviewLinks("one", delivery("new"))).toEqual(delivery("new"));
  const moved = { ...delivery("new"), url: "https://other.example.test/one.preview.webp" };
  expect(reusePreviewLinks("one", moved)).toEqual(moved);
  vi.stubGlobal("sessionStorage", {
    getItem() {
      throw new Error("disabled");
    },
  });
  expect(reusePreviewLinks("one", delivery("new"))).toEqual(delivery("new"));
});
