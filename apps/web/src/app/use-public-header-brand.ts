import { type RefObject, useCallback, useEffect, useRef } from "react";
import type { createLandingBrandRenderer } from "../features/home/landing/landing-brand-renderer";

/** 将首页和灵感库的滚动位置绘制到同一品牌时间轴，并保留静态素材回退。 */
export function usePublicHeaderBrand(
  headerRef: RefObject<HTMLElement | null>,
  scroll: RefObject<number>,
) {
  const brandRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const schedule = useRef<(() => void) | null>(null);
  const scheduleDraw = useCallback(() => schedule.current?.(), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const brand = brandRef.current;
    const header = headerRef.current;
    if (!canvas || !brand || !header) return;

    const abort = new AbortController();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let renderer: Awaited<ReturnType<typeof createLandingBrandRenderer>> | undefined;
    let frame = 0;

    function draw() {
      frame = 0;
      if (!canvas || !brand || !header) return;
      // 滚动前 500px 播放一次交接，向上滚动时沿同一时间轴倒放。
      const progress = Math.max(0, Math.min(1, scroll.current / 500));
      if (progress > 0) header.dataset.scrolled = "true";
      else delete header.dataset.scrolled;
      brand.style.setProperty("--site-brand-progress", String(progress));
      const riveReady = !!renderer && !reducedMotion.matches;
      if (riveReady) renderer?.draw(progress, canvas.clientWidth, canvas.clientHeight);
      brand.toggleAttribute("data-rive-ready", riveReady);
    }

    function requestDraw() {
      if (!frame) frame = window.requestAnimationFrame(draw);
    }

    schedule.current = requestDraw;
    draw();
    window.addEventListener("resize", requestDraw, { passive: true });
    reducedMotion.addEventListener("change", requestDraw);
    // Rive 单独分包，网络或初始化失败时继续用 SVG。
    void import("../features/home/landing/landing-brand-renderer")
      .then(async ({ createLandingBrandRenderer }) => {
        const next = await createLandingBrandRenderer(canvas, abort.signal);
        if (abort.signal.aborted) {
          next.dispose();
          return;
        }
        renderer = next;
        requestDraw();
      })
      .catch(() => {
        if (!abort.signal.aborted) requestDraw();
      });

    return () => {
      abort.abort();
      window.cancelAnimationFrame(frame);
      schedule.current = null;
      window.removeEventListener("resize", requestDraw);
      reducedMotion.removeEventListener("change", requestDraw);
      renderer?.dispose();
    };
  }, [headerRef, scroll]);

  return { brandRef, canvasRef, scheduleDraw };
}
