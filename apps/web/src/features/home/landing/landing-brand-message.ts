type BrandFields = Record<"type" | "x" | "y" | "width" | "height" | "progress" | "theme", unknown>;

function hasBrandFields(data: unknown): data is BrandFields {
  if (!data || typeof data !== "object") return false;
  return ["type", "x", "y", "width", "height", "progress", "theme"].every((key) => key in data);
}

/** 验证隔离页的品牌位置与动画进度，拒绝无效尺寸和非有限数值。 */
export function readLandingBrand(data: unknown) {
  if (!hasBrandFields(data) || data.type !== "lycobo:brand") return null;
  const { x, y, width, height, progress, theme } = data;
  if (typeof x !== "number" || typeof y !== "number" || typeof progress !== "number") return null;
  if (typeof width !== "number" || typeof height !== "number") return null;
  if (![x, y, width, height, progress].every(Number.isFinite)) return null;
  if (width <= 0 || width > 200 || height <= 0 || height > 100) return null;
  if (progress < 0 || progress > 1 || (theme !== "light" && theme !== "dark")) return null;
  return { x, y, width, height, progress, theme };
}
