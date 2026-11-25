import { type RefObject, useEffect, useRef } from "react";
import type { createLandingBrandRenderer } from "../features/home/landing/landing-brand-renderer";

/** 将首页的滚动位置绘制到品牌时间轴，并保留静态素材回退。 */
export function usePublicHeaderBrand(headerRef: RefObject<HTMLElement | null>, animated: boolean) {
  const brandRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const brand = brandRef.current;
    const header = headerRef.current;
    if (!animated || !canvas || !brand || !header) return;

    const abort = new AbortController();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let renderer: Awaited<ReturnType<typeof createLandingBrandRenderer>> | undefined;
    let frame = 0;

    function draw() {
      frame = 0;
      if (!canvas || !brand || !header) return;
      // 滚动前 500px 播放一次交接，向上滚动时沿同一时间轴倒放。
      const progress = Math.max(0, Math.min(1, window.scrollY / 500));
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

    draw();
    window.addEventListener("scroll", requestDraw, { passive: true });
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
      window.removeEventListener("scroll", requestDraw);
      window.removeEventListener("resize", requestDraw);
      reducedMotion.removeEventListener("change", requestDraw);
      renderer?.dispose();
      delete header.dataset.scrolled;
      brand.style.removeProperty("--site-brand-progress");
      brand.removeAttribute("data-rive-ready");
    };
  }, [animated, headerRef]);

  return { brandRef, canvasRef };
}
