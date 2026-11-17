import { type RefObject, useEffect, useRef } from "react";
import { readLandingBrand } from "./landing-brand-message";
import type { createLandingBrandRenderer } from "./landing-brand-renderer";

type BrandRenderer = Awaited<ReturnType<typeof createLandingBrandRenderer>>;

/** 在隔离页品牌链接上绘制 Rive，保留原链接的焦点、点击与静态回退。 */
export function LandingBrandCanvas({
  frameRef,
  document,
}: {
  frameRef: RefObject<HTMLIFrameElement | null>;
  document: string | undefined;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !document) return;
    const abort = new AbortController();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let renderer: BrandRenderer | null = null;
    let latest: ReturnType<typeof readLandingBrand> = null;
    let frame = 0;

    function draw() {
      frame = 0;
      if (!canvas || !renderer || !latest || reducedMotion.matches) return;
      const { x, y, width, height, progress, theme } = latest;
      renderer.draw(progress, width, height);
      Object.assign(canvas.style, {
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
        visibility: "visible",
        filter: theme === "light" ? "invert(1)" : "none",
      });
      frameRef.current?.contentWindow?.postMessage(
        { type: "lycobo:brand-ready", ready: true },
        "*",
      );
    }

    function receive(event: MessageEvent<unknown>) {
      if (event.source !== frameRef.current?.contentWindow) return;
      const next = readLandingBrand(event.data);
      if (!next) return;
      latest = next;
      if (!frame) frame = requestAnimationFrame(draw);
    }

    function syncMotion() {
      if (reducedMotion.matches) {
        if (canvas) canvas.style.visibility = "hidden";
        frameRef.current?.contentWindow?.postMessage(
          { type: "lycobo:brand-ready", ready: false },
          "*",
        );
      } else if (!frame) {
        frame = requestAnimationFrame(draw);
      }
    }

    window.addEventListener("message", receive);
    reducedMotion.addEventListener("change", syncMotion);
    // 动画库单独分包；加载或初始化失败时继续使用隔离页的 SVG，不阻塞首页。
    void import("./landing-brand-renderer")
      .then(async ({ createLandingBrandRenderer }) => {
        const next = await createLandingBrandRenderer(canvas, abort.signal);
        if (abort.signal.aborted) {
          next.dispose();
          return;
        }
        renderer = next;
        frameRef.current?.contentWindow?.postMessage({ type: "lycobo:brand-request" }, "*");
        syncMotion();
      })
      .catch(() => {
        canvas.style.visibility = "hidden";
      });

    return () => {
      abort.abort();
      cancelAnimationFrame(frame);
      window.removeEventListener("message", receive);
      reducedMotion.removeEventListener("change", syncMotion);
      renderer?.dispose();
      canvas.style.visibility = "hidden";
      frameRef.current?.contentWindow?.postMessage(
        { type: "lycobo:brand-ready", ready: false },
        "*",
      );
    };
  }, [document, frameRef]);
  return (
    <div aria-hidden="true">
      <canvas ref={canvasRef} className="landing-brand-canvas" />
    </div>
  );
}
