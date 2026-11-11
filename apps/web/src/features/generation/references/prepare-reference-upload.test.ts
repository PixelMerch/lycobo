import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useLocaleStore } from "../../../i18n/locale-store";
import { prepareReferenceUpload } from "./prepare-reference-upload";

// 断言按中文文案编写，固定界面语言。
beforeEach(() => useLocaleStore.setState({ locale: "zh-CN" }));
afterEach(() => vi.unstubAllGlobals());
function browser(outputBytes: number, width = 1200) {
  const close = vi.fn();
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ clearRect: vi.fn(), drawImage: vi.fn() }),
    toBlob: vi.fn((callback: (blob: Blob) => void) =>
      callback(new Blob([new Uint8Array(outputBytes)], { type: "image/webp" })),
    ),
  };
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width, height: 800, close })),
  );
  vi.stubGlobal("document", { createElement: () => canvas });
  return { canvas, close };
}
it("compresses references below 5 MB as WebP rather than skipping encoding", async () => {
  const f = browser(10000);
  const result = await prepareReferenceUpload(
    new Blob([new Uint8Array(200000)], { type: "image/png" }),
    1,
  );
  expect(result.size).toBe(10000);
  expect(result.type).toBe("image/webp");
  expect(f.canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/webp", 0.85);
  expect(f.close).toHaveBeenCalledOnce();
});
it("does not replace a smaller original or enlarge dimensions", async () => {
  const f = browser(20000);
  const original = new Blob([new Uint8Array(1000)], { type: "image/png" });
  expect(await prepareReferenceUpload(original, 1)).toBe(original);
  expect(f.canvas.width).toBe(1200);
});
it("limits the longest edge and releases decoded resources on failure", async () => {
  const f = browser(10000, 6000);
  await prepareReferenceUpload(new Blob([new Uint8Array(200000)]), 1);
  expect(f.canvas.width).toBe(3840);
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => null }) });
  await expect(prepareReferenceUpload(new Blob(["fixture"]), 2)).rejects.toThrow("第 2 张");
  expect(f.close).toHaveBeenCalledTimes(2);
});
