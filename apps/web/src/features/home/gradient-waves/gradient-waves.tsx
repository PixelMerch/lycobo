import { useEffect, useRef } from "react";
import { mountGradientWaves } from "./gradient-waves-renderer";
import "./gradient-waves.css";

/** 首页首屏的缎面光波背景；WebGL2 不可用时显示同色 CSS 渐变。 */
export function GradientWaves() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    return mountGradientWaves(element);
  }, []);

  return <div aria-hidden="true" className="gradient-waves" data-ready="true" ref={host} />;
}
