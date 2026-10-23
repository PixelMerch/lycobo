/** 首页标题：按顺序循环；可在这里修改文案、配色和停留时间。 */
export const homeIntro = {
  phrases: [
    { text: "聊聊创作想法", palette: "aurora" },
    { text: "让商品成为焦点", palette: "sunset" },
    { text: "为商品搭个场景", palette: "ocean" },
    { text: "把灵感变成好图", palette: "blossom" },
    { text: "创作下一张好图", palette: "citrus" },
  ],
  interval: 3000,
  staggerDuration: 0.035,
  blur: 4,
  spring: { damping: 25, stiffness: 300 },
} as const;
