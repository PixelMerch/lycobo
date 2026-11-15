/** 首页平台示例、演示数据与图片路径。 */
export const examples = [
  {
    id: "bedding",
    platform: "TikTok Shop",
    logo: "/landing/showcase/tiktok.svg",
    metric: "views",
    values: [12800, 18300],
    price: "$59.99",
    rating: "4.9",
    reviews: "1,284",
    visits: [1100, 1240],
  },
  {
    id: "fashion",
    platform: "Amazon",
    logo: "/landing/showcase/amazon.svg",
    metric: "carts",
    values: [96, 128],
    price: "$89.99",
    rating: "4.8",
    reviews: "2,106",
    visits: [1500, 1680],
  },
  {
    id: "blender",
    platform: "Temu",
    logo: "/landing/showcase/temu.png",
    metric: "orders",
    values: [28, 37],
    price: "$12.99",
    compareAt: "$19.99",
    rating: "4.7",
    reviews: "8,942",
    visits: [1350, 1460],
  },
  {
    id: "serum",
    platform: "Shopify",
    logo: "/landing/showcase/shopify.svg",
    metric: "sales",
    values: [684, 1026],
    price: "$38.00",
    rating: "4.9",
    reviews: "842",
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
