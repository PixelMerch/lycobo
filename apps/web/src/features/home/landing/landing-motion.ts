import { stagger } from "motion/react";

/** 首页所有区块共用的缓动曲线与入场视口配置，保持全局动效节奏一致。 */
export const landingEase: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const landingViewport = { once: true, amount: 0.25 } as const;

/** 让同一组标题、说明和入口依阅读顺序入场。 */
export const landingTextSequence = {
  hidden: {},
  visible: { transition: { delayChildren: stagger(0.075) } },
};

/** 文字短距离上移和淡入，正常文档流负责定位。 */
export const landingTextReveal = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.58, ease: landingEase } },
};
