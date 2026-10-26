/** Camera angles for the home-textile main-image variations tool. */
export const textileViews = [
  { id: "overhead-wide", name: "俯拍全景" },
  { id: "overhead-close", name: "俯拍近景" },
  { id: "close-up", name: "近距离特写" },
  { id: "pillow", name: "枕头特写" },
  { id: "bed-end", name: "床尾特写" },
  { id: "angled-overhead", name: "45度角俯拍" },
  { id: "front", name: "正面" },
  { id: "angled-level", name: "45度角平拍" },
  { id: "draped", name: "被子拖地" },
  { id: "fabric", name: "面料特写" },
] as const;
export type TextileViewId = (typeof textileViews)[number]["id"];

/** Static AI-generated examples only; never submitted as user reference images. */
export const textileViewImages = {
  "overhead-wide": "/studio/textile-views/overhead-wide.webp",
  "overhead-close": "/studio/textile-views/overhead-close.webp",
  "close-up": "/studio/textile-views/close-up.webp",
  pillow: "/studio/textile-views/pillow.webp",
  "bed-end": "/studio/textile-views/bed-end.webp",
  "angled-overhead": "/studio/textile-views/angled-overhead.webp",
  front: "/studio/textile-views/front.webp",
  "angled-level": "/studio/textile-views/angled-level.webp",
  draped: "/studio/textile-views/draped.webp",
  fabric: "/studio/textile-views/fabric.webp",
} satisfies Record<TextileViewId, string>;
