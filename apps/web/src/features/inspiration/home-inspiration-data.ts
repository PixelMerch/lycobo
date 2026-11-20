import type { Locale } from "../../i18n/locale";
import { homeInspirationMessages } from "./home-inspiration-messages";

/** 本地 AI 生成的灵感示例，不是客户作品，也不是模型评测；标题与提示词在 home-inspiration-messages.ts。 */
export const inspirationCategories = ["all", "product", "scene", "textile", "creative"] as const;
/** 灵感分类 id，all 表示不筛选。 */
export type InspirationCategory = (typeof inspirationCategories)[number];
type InspirationId = keyof (typeof homeInspirationMessages)[Locale]["items"];
type InspirationSample = {
  id: InspirationId;
  category: Exclude<InspirationCategory, "all">;
  image: string;
  shape: "portrait" | "square" | "landscape";
};
/** 按界面语言带上标题与提示词的灵感示例。 */
export type HomeInspiration = InspirationSample & { title: string; prompt: string };

// 顺序按瀑布流安排：竖、方、横交替，米白家纺穿插在彩色图之间。
// samples/ 下的图切自 commerce-atlas.webp（内置 imagegen 生成的示例图集，见 docs/image-studio-implementation.md）。
const inspirationSamples: InspirationSample[] = [
  {
    id: "water-perfume",
    category: "product",
    image: "/studio/models/image-2-1.webp",
    shape: "portrait",
  },
  {
    id: "glass-flower",
    category: "creative",
    image: "/studio/models/banana-1.webp",
    shape: "square",
  },
  {
    id: "textile-front",
    category: "textile",
    image: "/studio/textile-views/front.webp",
    shape: "portrait",
  },
  {
    id: "white-perfume",
    category: "product",
    image: "/studio/samples/white-perfume.webp",
    shape: "square",
  },
  {
    id: "fashion-blue",
    category: "scene",
    image: "/studio/models/image-2-5-1.webp",
    shape: "portrait",
  },
  {
    id: "citrus-splash",
    category: "creative",
    image: "/studio/samples/citrus-splash.webp",
    shape: "portrait",
  },
  {
    id: "amber-perfume",
    category: "product",
    image: "/studio/models/image-2-2.webp",
    shape: "square",
  },
  {
    id: "textile-pillow",
    category: "textile",
    image: "/studio/textile-views/pillow.webp",
    shape: "landscape",
  },
  {
    id: "stone-perfume",
    category: "scene",
    image: "/studio/samples/stone-perfume.webp",
    shape: "portrait",
  },
  {
    id: "white-footwear",
    category: "product",
    image: "/studio/models/image-2-3.webp",
    shape: "landscape",
  },
  {
    id: "lavender-bedding",
    category: "textile",
    image: "/studio/lavender-thumb.webp",
    shape: "square",
  },
  {
    id: "paper-metal",
    category: "creative",
    image: "/studio/models/image-2-5-3.webp",
    shape: "landscape",
  },
  {
    id: "white-handbag",
    category: "product",
    image: "/studio/samples/white-handbag.webp",
    shape: "square",
  },
  {
    id: "cream-bedroom",
    category: "scene",
    image: "/studio/bedroom-thumb.webp",
    shape: "portrait",
  },
  {
    id: "glass-pavilion",
    category: "creative",
    image: "/studio/models/banana-2.webp",
    shape: "landscape",
  },
  {
    id: "textile-fabric",
    category: "textile",
    image: "/studio/textile-views/fabric.webp",
    shape: "square",
  },
  {
    id: "bag-editorial",
    category: "scene",
    image: "/studio/models/image-2-5-2.webp",
    shape: "portrait",
  },
  {
    id: "white-soda",
    category: "product",
    image: "/studio/samples/white-soda.webp",
    shape: "portrait",
  },
  {
    id: "textile-draped",
    category: "textile",
    image: "/studio/textile-views/draped.webp",
    shape: "portrait",
  },
  {
    id: "sunlit-handbag",
    category: "scene",
    image: "/studio/samples/sunlit-handbag.webp",
    shape: "square",
  },
  {
    id: "alpine-sunrise",
    category: "creative",
    image: "/studio/models/banana-3.webp",
    shape: "landscape",
  },
  { id: "folded-textile", category: "product", image: "/studio/set-thumb.webp", shape: "square" },
  {
    id: "textile-overhead",
    category: "textile",
    image: "/studio/textile-views/overhead-wide.webp",
    shape: "square",
  },
];

/** 当前语言的灵感示例列表。 */
export function homeInspirationsFor(locale: Locale): HomeInspiration[] {
  const items = homeInspirationMessages[locale].items;
  return inspirationSamples.map((sample) => ({ ...sample, ...items[sample.id] }));
}
