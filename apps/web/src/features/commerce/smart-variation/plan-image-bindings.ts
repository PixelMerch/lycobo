import { create } from "zustand";

type BindingState = {
  bindings: Record<string, number[]>;
  setBinding: (itemId: string, numbers: number[]) => void;
};

/**
 * 每条方案手动选过的原图编号，按方案 id 记在本次会话；
 * 没手动选过的方案，按提示词里提到的编号对应原图。
 */
export const usePlanBindings = create<BindingState>((set) => ({
  bindings: {},
  setBinding: (itemId, numbers) =>
    set((state) => ({ bindings: { ...state.bindings, [itemId]: numbers } })),
}));

// 一处提到的参考图：开头一个编号，后面可接列举或范围，如“参考图1、2”“参考图2-4”“参考图1至参考图3”。
// 列举里不带前缀的数字后面若紧跟量词、字母、单位或比例冒号（如“2个枕套”“3D”“9:16”），不算参考图编号。
const mentionPattern =
  /(?:参考图|@图片)\s*([1-9]\d*)((?:\s*[、,，/和与及或~～至到\-–—]\s*(?:参考图|@图片)?\s*[1-9]\d*(?![\d.]|\s*[A-Za-z个张件只条套款色种层寸米厘克号%倍组对片块幅×*:：]))*)/g;
const followingPattern = /([、,，/和与及或~～至到\-–—])\s*(?:参考图|@图片)?\s*([1-9]\d*)/g;
const rangeMark = /^[~～至到\-–—]$/;

/** 提示词里提到的参考图编号：规划生成的“参考图N”与用户输入的“@图片N”都算，列举和范围逐个展开。 */
export function mentionedImageNumbers(prompt: string) {
  const numbers = new Set<number>();
  for (const [, first, rest = ""] of prompt.matchAll(mentionPattern)) {
    let previous = Number(first);
    numbers.add(previous);
    for (const [, mark, value] of rest.matchAll(followingPattern)) {
      const number = Number(value);
      // 范围最多展开 10 张，参考图本身最多 10 张，超出的当成单个编号。
      const isRange = rangeMark.test(mark ?? "") && number > previous && number - previous <= 10;
      for (let next = isRange ? previous + 1 : number; next <= number; next++) numbers.add(next);
      previous = number;
    }
  }
  return numbers;
}

/** 提示词提到的、在已上传张数范围内的参考图编号。 */
function mentionsWithin(prompt: string, count: number) {
  return [...mentionedImageNumbers(prompt)].filter((number) => number <= count);
}

/** 方案共用图和逐条分配的原图，编号从 1 开始。 */
export type PlanUsage = { shared: number[]; sources: number[] };

/**
 * 按全部方案（含未勾选）的提示词推断用图：每条用图提示词都提到的图共用，其余逐条对应。
 * 提示词都没指定编号时，每条方案沿用全部参考图。
 */
export function planUsage(referenceCount: number, items: readonly { prompt: string }[]): PlanUsage {
  const mentions = items
    .map(({ prompt }) => new Set(mentionsWithin(prompt, referenceCount)))
    .filter((numbers) => numbers.size > 0);
  const numbers = Array.from({ length: referenceCount }, (_, index) => index + 1);
  const shared = numbers.filter((number) => mentions.every((group) => group.has(number)));
  return { shared, sources: numbers.filter((number) => !shared.includes(number)) };
}

/** 读取某条方案的共用图、候选原图和当前选中的原图。 */
export function planImages(
  usage: PlanUsage,
  prompt: string,
  override: readonly number[] | undefined,
) {
  const mentioned = mentionsWithin(prompt, usage.shared.length + usage.sources.length);
  const fallback = mentioned.length ? mentioned : usage.sources;
  return { ...usage, bound: new Set(override ?? fallback) };
}

/**
 * 提交时每条方案要发送的参考图下标（从 0 开始，保持原顺序）：共用图加本条对应的原图。
 * 无需逐条分配时返回 undefined，每条方案共用全部参考图。
 */
export function itemReferenceIndexes(
  items: readonly { id: string; prompt: string }[],
  usage: PlanUsage,
  bindings: Record<string, number[]>,
) {
  if (!usage.sources.length) return undefined;
  return Object.fromEntries(
    items.map((item) => {
      const { shared, sources, bound } = planImages(usage, item.prompt, bindings[item.id]);
      const numbers = [...shared, ...sources.filter((number) => bound.has(number))];
      return [item.id, numbers.sort((left, right) => left - right).map((number) => number - 1)];
    }),
  );
}
