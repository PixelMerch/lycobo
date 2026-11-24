import type { createLandingMotionTimeline } from "./landing-motion-timeline";

/** 调度滚动绘制与入场观察，在偏好变化和页面退出时清理动效，不接管浏览器滚动。 */
export function initializeLandingMotion(
  createTimeline: () => ReturnType<typeof createLandingMotionTimeline>,
) {
  const timeline = createTimeline();
  if (!timeline) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reveals = [...document.querySelectorAll<HTMLElement>("[data-reveal]")];
  let observer: IntersectionObserver | undefined;
  let frame = 0;
  let previousTime = 0;
  let current = window.scrollY;
  let disposed = false;

  function measure() {
    if (disposed) return;
    timeline?.measure();
    current = window.scrollY;
    schedule();
  }

  function draw(time: number) {
    frame = 0;
    if (reduced.matches || disposed) return;
    const delta = previousTime ? Math.min(time - previousTime, 40) : 16;
    previousTime = time;
    // 仅平滑视觉层；停止输入后迅速收敛，避免持续占用渲染帧。
    current += (window.scrollY - current) * (1 - Math.exp(-delta / 65));
    timeline?.draw(current);
    if (Math.abs(window.scrollY - current) > 0.15) schedule();
    else previousTime = 0;
  }

  function schedule() {
    if (!frame && !reduced.matches && !disposed) frame = requestAnimationFrame(draw);
  }

  function configure() {
    observer?.disconnect();
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
    document.body.toggleAttribute("data-motion-ready", !reduced.matches);
    if (reduced.matches) {
      timeline?.reset();
      for (const element of reveals) element.removeAttribute("data-reveal-pending");
      return;
    }
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.removeAttribute("data-reveal-pending");
          observer?.unobserve(entry.target);
        }
      },
      { threshold: 0.1 },
    );
    for (const element of reveals) {
      if (element.getBoundingClientRect().top > window.innerHeight) {
        element.setAttribute("data-reveal-pending", "");
        observer.observe(element);
      }
    }
    measure();
  }

  configure();
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", measure, { passive: true });
  window.addEventListener("load", measure, { once: true });
  document.addEventListener("focusin", schedule);
  document.addEventListener("focusout", schedule);
  reduced.addEventListener("change", configure);
  void document.fonts.ready.then(measure);
  window.addEventListener(
    "pagehide",
    () => {
      disposed = true;
      observer?.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      window.removeEventListener("load", measure);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      reduced.removeEventListener("change", configure);
    },
    { once: true },
  );
}
