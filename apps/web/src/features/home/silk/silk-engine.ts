import { type Rgb, type SilkInput, SilkMotion, type SilkPointer } from "./silk-motion";
import { createSilkRenderer, type SilkLook } from "./silk-renderer";

// 首页取值：褶皱斜向流动、光泽与柔光适中，颗粒略弱，避免抢正文。
const look: SilkLook = {
  scale: 1,
  rotation: 0.35,
  wave: 1,
  ripple: 1,
  sheen: 0.55,
  depth: 0.6,
  glow: 0.3,
  noiseIntensity: 1.2,
};
const speed = 2.4;
const interactionStrength = 0.8;
// 丝绸是柔和背景，限制像素比以减轻 GPU 负担。
const maxPixelRatio = 1.25;

/** 运行中的丝绸背景：换色、按屏幕坐标荡开涟漪、停止并释放资源。 */
export type SilkEngine = {
  setPalette: (color: Rgb, sheen: Rgb) => void;
  pulseAt: (clientX: number, clientY: number) => void;
  stop: () => void;
};

/**
 * 在容器里启动丝绸背景：逐帧推进动画并绘制，离开视口或切到后台标签页时暂停，
 * 减少动态效果时只画静止画面。不支持 WebGL2 或没有 GPU 加速时返回 null，页面保留静态渐变。
 */
export function startSilk(container: HTMLElement): SilkEngine | null {
  // 每次启动都新建画布：停止时会释放 WebGL 上下文，复用旧画布只能拿到失效的上下文
  // （开发模式下 React 会先卸载再挂载一次）。
  const canvas = document.createElement("canvas");
  canvas.className = "silk-background-canvas";
  const renderer = createSilkRenderer(canvas, look);
  if (!renderer) return null;
  container.append(canvas);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  // 减少动态效果时只画静止画面：不流动、不展开、没有涟漪，换色直接生效。
  const still = () => reduceMotion.matches;
  const motion = new SilkMotion(!still());
  const pointer: SilkPointer = { x: 0, y: 0, inside: false };
  const input: SilkInput = {
    width: 1,
    height: 1,
    pointer,
    speed,
    interactionStrength,
    still: still(),
  };
  let raf = 0;
  let last = 0;
  let visible = true;

  function frame(now: number) {
    raf = 0;
    if (!visible || document.hidden || !renderer) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    input.still = still();
    const busy = motion.step(dt, input);
    renderer.render(motion.frame(input));
    if (busy) raf = requestAnimationFrame(frame);
    else last = 0;
  }
  function wake() {
    if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function resize() {
    input.width = Math.max(1, container.clientWidth);
    input.height = Math.max(1, container.clientHeight);
    renderer?.resize(
      input.width,
      input.height,
      Math.min(window.devicePixelRatio || 1, maxPixelRatio),
    );
    renderer?.render(motion.frame(input));
    wake();
  }
  // 容器在内容下层、不接收指针，所以在窗口上监听并换算到容器坐标。
  function onPointerMove(event: PointerEvent) {
    const rect = container.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.inside =
      pointer.x >= 0 && pointer.y >= 0 && pointer.x <= rect.width && pointer.y <= rect.height;
    wake();
  }
  function onPointerLeave() {
    pointer.inside = false;
    wake();
  }
  function onVisibility() {
    last = 0;
    wake();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  const intersection = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    last = 0;
    wake();
  });
  intersection.observe(container);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  document.documentElement.addEventListener("pointerleave", onPointerLeave);
  document.addEventListener("visibilitychange", onVisibility);
  reduceMotion.addEventListener("change", onVisibility);
  resize();

  return {
    setPalette(color, sheen) {
      motion.setPalette(color, sheen);
      wake();
    },
    pulseAt(clientX, clientY) {
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height || still()) return;
      motion.pulse((clientX - rect.left) / rect.width, 1 - (clientY - rect.top) / rect.height);
      wake();
    },
    stop() {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersection.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      reduceMotion.removeEventListener("change", onVisibility);
      renderer.dispose();
      canvas.remove();
    },
  };
}
