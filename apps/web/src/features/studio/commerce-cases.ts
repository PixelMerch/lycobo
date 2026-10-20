export const commerceCases = [
  {
    id: "perfume",
    title: "香水 · 自然光场景",
    category: "美妆个护",
    use: "场景图",
    description: "保留商品细节，换一个好场景",
    prompt:
      "保留参考商品的瓶身、标签与颜色，将香水放在阳光照射的米色石台上，点缀洋甘菊，柔和自然光，真实商业产品摄影，不添加文字。",
  },
  {
    id: "bag",
    title: "箱包 · 商品主图",
    category: "服饰箱包",
    use: "商品主图",
    description: "让材质与轮廓成为画面焦点",
    prompt:
      "保留参考包袋的形状、颜色、五金和皮革纹理，在暖色石质展台上拍摄干净的电商商品主图，柔和侧光，细节清晰，不添加文字。",
  },
  {
    id: "drink",
    title: "食品饮料 · 创意海报",
    category: "食品饮料",
    use: "创意海报",
    description: "从商品参考到夏日广告",
    prompt:
      "保留参考饮料的罐体、包装和标签，搭配西柚切片、冰块与清澈水花，蓝色清爽背景，夏日商业广告摄影，不编造产品功效，不添加额外文字。",
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
