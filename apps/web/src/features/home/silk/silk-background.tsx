import { type Ref, useEffect, useImperativeHandle, useRef } from "react";
import { type SilkEngine, startSilk } from "./silk-engine";
import type { Rgb } from "./silk-motion";
import "./silk-background.css";

/** 一种丝绸配色：底色与光泽色，均为 #RRGGBB。 */
export type SilkPalette = { color: string; sheen: string };

/** 页面可调用的动画：在屏幕坐标处荡开一圈涟漪，并让褶皱短暂加速。 */
export type SilkHandle = { pulseAt: (clientX: number, clientY: number) => void };

function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

/**
 * 丝绸流动背景（改编自 React Bits Silk）：铺满父容器，配色变化时平滑过渡。
 * 纯装饰、不接收指针；不支持 WebGL2 时什么都不画，由父容器的静态渐变兜底。
 */
export function SilkBackground({ palette, ref }: { palette: SilkPalette; ref?: Ref<SilkHandle> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SilkEngine | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // 画布由引擎创建并放进容器，卸载时随引擎一起移除。
    const engine = startSilk(container);
    engineRef.current = engine;
    return () => {
      engine?.stop();
      engineRef.current = null;
    };
  }, []);

  // 挂载时第一次设置直接生效，之后的配色变化在动画里平滑过渡。
  useEffect(() => {
    engineRef.current?.setPalette(hexToRgb(palette.color), hexToRgb(palette.sheen));
  }, [palette.color, palette.sheen]);

  useImperativeHandle(
    ref,
    () => ({ pulseAt: (clientX, clientY) => engineRef.current?.pulseAt(clientX, clientY) }),
    [],
  );

  return <div ref={containerRef} className="silk-background" aria-hidden="true" />;
}
