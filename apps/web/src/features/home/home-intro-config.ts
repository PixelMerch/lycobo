/** 首页标题：按顺序循环；可在这里修改文案、配色和停留时间。 */
export const homeIntro = {
  phrases: [
    { text: "聊聊创作想法", palette: "silver" },
    { text: "让商品成为焦点", palette: "silver" },
    { text: "为商品搭个场景", palette: "silver" },
    { text: "把灵感变成好图", palette: "silver" },
    { text: "创作下一张好图", palette: "silver" },
  ],
  interval: 4800,
  staggerDuration: 0.035,
  blur: 2,
  spring: { damping: 25, stiffness: 300 },
} as const;
