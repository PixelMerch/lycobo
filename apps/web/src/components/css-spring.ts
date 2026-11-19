import { spring } from "motion";

/** 把物理弹簧转换成可打断的 CSS 过渡曲线。 */
export function cssSpring(parameters: { stiffness: number; damping: number }) {
  return spring({ keyframes: [0, 1], restDelta: 0.02, restSpeed: 0.2, ...parameters }).toString();
}
