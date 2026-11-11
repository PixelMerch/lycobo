import type { ReferenceRole } from "@lycoboai/contracts";
import { create } from "zustand";
import {
  roleOf,
  submissionReferenceRoles,
  useReferenceRoles,
} from "../../generation/references/reference-roles";

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

/** 本次计划里参考图的用法：每张图实际按什么角色处理，以及原图是不是按提示词推断出来的。 */
export type PlanUsage = { roles: Record<string, ReferenceRole>; inferred: boolean };

/**
 * 计划里每张参考图的实际角色。标过原图时完全按用户标的；没标时，未标角色的图按全部方案（含未勾选）的提示词推断：
 * 提到参考图的方案都提到的图共用，其余按原图逐条对应（没被任何方案提到的不发送）。
 * 例如五张图各写一条“参考图N改成9:16”，每条只发自己那张，不会都去改第一张。
 */
export function planUsage(
  references: readonly { id: string }[],
  roles: Record<string, ReferenceRole>,
  prompts: readonly string[],
): PlanUsage {
  const asMarked = { roles, inferred: false };
  if (references.some((image) => roles[image.id] === "source")) return asMarked;
  const mentions = prompts
    .map((prompt) => new Set(mentionsWithin(prompt, references.length)))
    .filter((numbers) => numbers.size > 0);
  const unmarked = references.flatMap((image, index) => (roles[image.id] ? [] : [index + 1]));
  // 没有方案提到参考图时 every 恒为真，结果为空；每条都提到全部未标的图时也为空，两种都沿用原来的发送方式。
  const perItem = unmarked.filter((number) => !mentions.every((numbers) => numbers.has(number)));
  if (!perItem.length) return asMarked;
  const inferred = { ...roles };
  for (const number of perItem) {
    const image = references[number - 1];
    if (image) inferred[image.id] = "source";
  }
  return { roles: inferred, inferred: true };
}

/** 当前计划的参考图用法：读会话里标的角色和全部方案（含未勾选）的提示词。 */
export function usePlanUsage(
  references: readonly { id: string }[],
  items: readonly { prompt: string }[],
) {
  const roles = useReferenceRoles((state) => state.roles);
  return planUsage(
    references,
    roles,
    items.map((item) => item.prompt),
  );
}

/**
 * 提交时的参考图角色（与参考图顺序一致）。用户没标原图或风格时不带角色，服务端只写编号说明；
 * 标过时按本计划的实际角色提交，推断出的逐条原图按“原图”说明，不会被说成要保持颜色不变的商品图。
 */
export function planSubmissionRoles(references: readonly { id: string }[], usage: PlanUsage) {
  if (!submissionReferenceRoles(references)) return undefined;
  return references.map((image) => roleOf(usage.roles, image.id));
}

/** 一条方案的用图（编号从 1 开始）：共用的商品与风格图、全部原图，以及本条对应的原图。 */
export function planImages(
  references: readonly { id: string }[],
  usage: PlanUsage,
  prompt: string,
  override: readonly number[] | undefined,
) {
  const numbered = references.map((image, index) => ({
    role: roleOf(usage.roles, image.id),
    number: index + 1,
  }));
  const shared = numbered.filter(({ role }) => role !== "source").map(({ number }) => number);
  const sources = numbered.filter(({ role }) => role === "source").map(({ number }) => number);
  const mentioned = mentionsWithin(prompt, references.length);
  // 推断出的原图：没提到任何参考图的方案照旧使用全部原图，不会变成不带参考图的生成。
  const fallback = usage.inferred && !mentioned.length ? sources : mentioned;
  return { shared, sources, bound: new Set(override ?? fallback) };
}

/**
 * 提交时每条方案要发送的参考图下标（从 0 开始，保持原顺序）：共用图加本条对应的原图。
 * 没有任何原图（标的或推断的）时返回 undefined，沿用旧行为，每条方案发送全部参考图。
 */
export function itemReferenceIndexes(
  items: readonly { id: string; prompt: string }[],
  references: readonly { id: string }[],
  usage: PlanUsage,
  bindings: Record<string, number[]>,
) {
  if (!references.some((image) => roleOf(usage.roles, image.id) === "source")) return undefined;
  return Object.fromEntries(
    items.map((item) => {
      const { shared, sources, bound } = planImages(
        references,
        usage,
        item.prompt,
        bindings[item.id],
      );
      const numbers = [...shared, ...sources.filter((number) => bound.has(number))];
      return [item.id, numbers.sort((left, right) => left - right).map((number) => number - 1)];
    }),
  );
}
