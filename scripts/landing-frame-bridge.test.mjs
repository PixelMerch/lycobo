import { afterEach, describe, expect, it, vi } from "vitest";
import { initializeLandingFrameBridge } from "../apps/web/src/features/home/landing/landing-frame-bridge.ts";

afterEach(() => vi.unstubAllGlobals());

describe("landing FAQ scroll command", () => {
  it.each([false, true])(
    "accepts only the host and respects reduced motion: %s",
    async (reduced) => {
      const focus = vi.fn();
      const scrollIntoView = vi.fn();
      const parent = { postMessage: vi.fn() };
      const window = Object.assign(new EventTarget(), {
        scrollY: 0,
        matchMedia: () => ({ matches: reduced }),
      });
      const document = Object.assign(new EventTarget(), {
        fonts: { ready: Promise.resolve() },
        querySelector: () => ({ scrollIntoView, querySelector: () => ({ focus }) }),
      });
      vi.stubGlobal("parent", parent);
      vi.stubGlobal("window", window);
      vi.stubGlobal("document", document);
      initializeLandingFrameBridge();

      const dispatch = (source) =>
        window.dispatchEvent(
          Object.assign(new Event("message"), { source, data: "lycobo:landing-faq-request" }),
        );
      dispatch({});
      await Promise.resolve();
      expect(scrollIntoView).not.toHaveBeenCalled();
      dispatch(parent);
      await Promise.resolve();
      expect(focus).toHaveBeenCalledWith({ preventScroll: true });
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: reduced ? "instant" : "smooth",
        block: "start",
      });
    },
  );
});
