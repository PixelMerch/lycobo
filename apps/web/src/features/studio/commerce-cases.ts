export const commerceCases = [
  {
    id: "perfume",
    title: "床品 · 自然光场景",
    category: "家居家纺",
    use: "场景图",
    description: "保留商品细节，换一个好场景",
    prompt:
      "保留参考床品的颜色、绗缝与套件组成，放在自然光原木卧室中，柔和光线，真实家纺摄影，不添加文字。",
  },
  {
    id: "bag",
    title: "套件 · 商品主图",
    category: "家居家纺",
    use: "商品主图",
    description: "让材质与轮廓成为画面焦点",
    prompt:
      "保留参考被子与两个枕套的颜色和绗缝纹理，在干净白色背景中展示套件组成，柔和侧光，细节清晰，不添加文字。",
  },
  {
    id: "drink",
    title: "床品 · 换色海报",
    category: "家居家纺",
    use: "创意海报",
    description: "保留面料纹理，探索新的配色",
    prompt:
      "将参考床品改为浅紫色，保留绗缝、面料纹理和套件组成，柔和卧室光线，家纺商业海报，无文字。",
  },
  {
    id: "bedding",
    title: "家居家纺 · 卧室场景",
    category: "家居家纺",
    use: "场景图",
    description: "呈现真实可感的生活氛围",
    prompt:
      "保留参考床品的颜色、绗缝、面料与套件组成，放在温暖自然光的原木卧室中，整洁真实，商业家纺摄影，无文字。",
  },
] as const;
export type CommerceCase = (typeof commerceCases)[number];
