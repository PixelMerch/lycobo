import type { FreeCanvasItem, FreeCanvasItemKind } from "./free-canvas-state";

const storageKey = "lycobo:free-canvas:items";
const kinds: FreeCanvasItemKind[] = ["image", "text", "note"];

function numberField(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseItem(value: unknown) {
  if (!hasFields(value)) return null;
  const id = stringField(value.id);
  const kind = kinds.find((item) => item === value.kind);
  const x = numberField(value.x);
  const y = numberField(value.y);
  const width = numberField(value.width);
  const height = numberField(value.height);
  if (!id || !kind || x === null || y === null || width === null || height === null) return null;
  return withOptionalFields({ id, kind, x, y, width, height }, value);
}

/** 先确认结构和必需数值字段存在，避免使用类型断言读取未知对象。 */
function hasFields(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  return ["id", "kind", "x", "y", "width", "height"].every((key) => key in value);
}

function withOptionalFields(
  base: {
    id: string;
    kind: FreeCanvasItemKind;
    x: number;
    y: number;
    width: number;
    height: number;
  },
  value: Record<string, unknown>,
): FreeCanvasItem {
  const src = "src" in value ? stringField(value.src) : null;
  const text = "text" in value && typeof value.text === "string" ? value.text : null;
  return {
    ...base,
    rotation: "rotation" in value ? (numberField(value.rotation) ?? 0) : 0,
    ...(src ? { src } : {}),
    ...(text !== null ? { text } : {}),
  };
}

/** 只恢复本机保存的画布内容；结构不符的条目忽略，避免旧数据阻塞页面。 */
export function readStoredItems(): FreeCanvasItem[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      const parsedItem = parseItem(item);
      return parsedItem ? [parsedItem] : [];
    });
  } catch {
    return [];
  }
}

/** 保存画布内容到本机浏览器；存储不可用时静默跳过。 */
export function writeStoredItems(items: FreeCanvasItem[]) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(items));
  } catch {
    // 隐私模式或配额不足时仍允许继续编辑，只是刷新后不保留。
  }
}
