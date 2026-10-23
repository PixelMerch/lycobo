/** Example artwork is intentionally absent; add reviewed image paths here later. */
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

/** Add approved example URLs by view ID; empty entries render a white placeholder. */
export const textileViewImages: Partial<Record<TextileViewId, string>> = {};
