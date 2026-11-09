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

const inspirationSamples: InspirationSample[] = [
  {
    id: "water-perfume",
    category: "product",
    image: "/studio/models/image-2-1.webp",
    shape: "portrait",
  },
  {
    id: "cream-bedroom",
    category: "scene",
    image: "/studio/bedroom-thumb.webp",
    shape: "square",
  },
  {
    id: "glass-flower",
    category: "creative",
    image: "/studio/models/banana-1.webp",
    shape: "portrait",
  },
  {
    id: "white-footwear",
    category: "product",
    image: "/studio/models/image-2-3.webp",
    shape: "square",
  },
  {
    id: "fashion-blue",
    category: "scene",
    image: "/studio/models/image-2-5-1.webp",
    shape: "portrait",
  },
  {
    id: "textile-pillow",
    category: "textile",
    image: "/studio/textile-views/pillow.webp",
    shape: "square",
  },
  {
    id: "amber-perfume",
    category: "product",
    image: "/studio/models/image-2-2.webp",
    shape: "portrait",
  },
  {
    id: "bag-editorial",
    category: "scene",
    image: "/studio/models/image-2-5-2.webp",
    shape: "portrait",
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
    id: "textile-fabric",
    category: "textile",
    image: "/studio/textile-views/fabric.webp",
    shape: "square",
  },
  {
    id: "textile-front",
    category: "textile",
    image: "/studio/textile-views/front.webp",
    shape: "portrait",
  },
  {
    id: "folded-textile",
    category: "product",
    image: "/studio/set-thumb.webp",
    shape: "square",
  },
];

/** 当前语言的灵感示例列表。 */
export function homeInspirationsFor(locale: Locale): HomeInspiration[] {
  const items = homeInspirationMessages[locale].items;
  return inspirationSamples.map((sample) => ({ ...sample, ...items[sample.id] }));
}
