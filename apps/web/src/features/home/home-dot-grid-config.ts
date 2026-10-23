import type { DotGridProps } from "./dot-grid/dot-grid";

/** 首页上半部分背景参数：直接修改此处，保存后即可预览。 */
export const homeDotGrid = {
  dotSize: 1.5,
  gap: 15,
  baseColor: "#666666",
  activeColor: "#ffffff",
  proximity: 140,
  strength: 0.2,
  bounce: 0.15,
  tension: 0.4,
  returnDuration: 0.8,
  shockRadius: 320,
  shockStrength: 2,
  swell: 0.4,
  stretch: 0.3,
  glow: 0.3,
  shape: "circle",
  fade: 0.1,
  opacity: 0.7,
  intro: false,
  mouseInteraction: true,
  clickShock: true,
  paused: false,
  dpr: 1.5,
} satisfies DotGridProps;
