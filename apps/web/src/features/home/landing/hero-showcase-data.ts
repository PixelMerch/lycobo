/** 首页平台示例、演示数据与图片路径。 */
export const examples = [
  {
    id: "bedding",
    platform: "TikTok Shop",
    price: "$59.99",
    rating: "4.9",
    reviews: "1,284",
    orders: [22, 31],
    visits: [1100, 1240],
  },
  {
    id: "fashion",
    platform: "Amazon",
    price: "$89.99",
    rating: "4.8",
    reviews: "2,106",
    orders: [35, 44],
    visits: [1500, 1680],
  },
  {
    id: "blender",
    platform: "Temu",
    price: "$12.99",
    compareAt: "$19.99",
    rating: "4.7",
    reviews: "8,942",
    orders: [28, 37],
    visits: [1350, 1460],
  },
  {
    id: "serum",
    platform: "Shopify",
    price: "$38.00",
    rating: "4.9",
    reviews: "842",
    orders: [18, 27],
    visits: [900, 1100],
  },
] as const;

export type Example = (typeof examples)[number];
export type HeroExampleId = Example["id"];

/** 返回下一个平台示例，用于自动轮播。 */
export function nextExample(active: HeroExampleId) {
  const index = examples.findIndex((example) => example.id === active);
  return examples[(index + 1) % examples.length]?.id ?? examples[0].id;
}

/** 拼出指定案例的原图或成片路径。 */
export function exampleImage(id: HeroExampleId, phase: "before" | "after") {
  return `/landing/showcase/${id}-${phase}.webp`;
}
