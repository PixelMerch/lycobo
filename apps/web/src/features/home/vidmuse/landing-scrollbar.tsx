import { useEffect, useState } from "react";

type Thumb = { height: number; top: number };

/**
 * 首页的覆盖式滚动条：隐藏原生滚动槽，用固定定位的浅色滑块代替，
 * 滑块直接浮在页面内容上且不显示轨道背景；只作视觉指示，不拦截滚动。
 */
export function LandingScrollbar() {
  const [thumb, setThumb] = useState<Thumb | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("vm-scrollbar-hidden");
    const update = () => {
      const view = window.innerHeight;
      const total = root.scrollHeight;
      if (total <= view + 1) {
        setThumb(null);
        return;
      }
      const height = Math.max(44, (view * view) / total);
      const maxScroll = total - view;
      const top = Math.min(view - height, (window.scrollY / maxScroll) * (view - height));
      setThumb({ height, top });
    };
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      root.classList.remove("vm-scrollbar-hidden");
    };
  }, []);

  if (!thumb) return null;
  return (
    <div className="vm-overlay-scrollbar" aria-hidden="true">
      <span
        style={{
          height: `${thumb.height}px`,
          transform: `translate3d(0, ${thumb.top}px, 0)`,
        }}
      />
    </div>
  );
}
