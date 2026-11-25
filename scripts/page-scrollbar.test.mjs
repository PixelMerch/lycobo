import { afterEach, describe, expect, it, vi } from "vitest";
import { initializePageScrollbar } from "../apps/web/src/components/page-scrollbar.ts";

afterEach(() => vi.unstubAllGlobals());

describe("page scrollbar synchronization", () => {
  it("ignores delayed mirror events but follows user dragging and cleans up", () => {
    const rail = Object.assign(new EventTarget(), {
      scrollTop: 0,
      clientHeight: 600,
      classList: { add: vi.fn() },
      setAttribute: vi.fn(),
      append: vi.fn(),
      remove: vi.fn(),
    });
    const spacer = { style: {} };
    const panel = Object.assign(new EventTarget(), {
      scrollTop: 0,
      scrollHeight: 2000,
      clientHeight: 600,
      children: [],
      parentElement: { append: vi.fn() },
      scrollTo: vi.fn(),
    });
    const disconnect = vi.fn();
    vi.stubGlobal("window", new EventTarget());
    vi.stubGlobal("document", {
      createElement: vi.fn().mockReturnValueOnce(rail).mockReturnValueOnce(spacer),
    });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect = disconnect;
      },
    );
    const cleanup = initializePageScrollbar(panel);

    panel.scrollTop = 5;
    panel.dispatchEvent(new Event("scroll"));
    expect(rail.scrollTop).toBe(5);
    // 原生平滑滚动已经进入下一帧，上一帧轨道的 scroll 事件此时才送达。
    panel.scrollTop = 14;
    rail.dispatchEvent(new Event("scroll"));
    expect(panel.scrollTo).not.toHaveBeenCalled();

    rail.scrollTop = 240;
    rail.dispatchEvent(new Event("scroll"));
    expect(panel.scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 240, behavior: "instant" });
    cleanup();
    rail.scrollTop = 500;
    rail.dispatchEvent(new Event("scroll"));
    expect(panel.scrollTo).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledOnce();
    expect(rail.remove).toHaveBeenCalledOnce();
  });
});
