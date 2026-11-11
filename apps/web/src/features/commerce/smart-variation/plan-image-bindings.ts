import type { ReferenceRole } from "@lycoboai/contracts";
import { create } from "zustand";
import { roleOf } from "../../generation/references/reference-roles";

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

/** 提示词里提到的参考图编号：规划生成的“参考图N”与用户输入的“@图片N”都算。 */
export function mentionedImageNumbers(prompt: string) {
  return new Set([...prompt.matchAll(/(?:参考图|@图片)\s*([1-9]\d*)/g)].map(([, n]) => Number(n)));
}

/** 一条方案的用图（编号从 1 开始）：共用的商品与风格图、全部原图，以及本条对应的原图。 */
export function planImages(
  references: readonly { id: string }[],
  roles: Record<string, ReferenceRole>,
  prompt: string,
  override: readonly number[] | undefined,
) {
  const numbered = references.map((image, index) => ({
    role: roleOf(roles, image.id),
    number: index + 1,
  }));
  const shared = numbered.filter(({ role }) => role !== "source").map(({ number }) => number);
  const sources = numbered.filter(({ role }) => role === "source").map(({ number }) => number);
  const bound = new Set(override ?? mentionedImageNumbers(prompt));
  return { shared, sources, bound };
}

/**
 * 提交时每条方案要发送的参考图下标（从 0 开始，保持原顺序）：共用图加本条对应的原图。
 * 没有任何原图时返回 undefined，沿用旧行为，每条方案发送全部参考图。
 */
export function itemReferenceIndexes(
  items: readonly { id: string; prompt: string }[],
  references: readonly { id: string }[],
  roles: Record<string, ReferenceRole>,
  bindings: Record<string, number[]>,
) {
  if (!references.some((image) => roleOf(roles, image.id) === "source")) return undefined;
  return Object.fromEntries(
    items.map((item) => {
      const { shared, sources, bound } = planImages(
        references,
        roles,
        item.prompt,
        bindings[item.id],
      );
      const numbers = [...shared, ...sources.filter((number) => bound.has(number))];
      return [item.id, numbers.sort((left, right) => left - right).map((number) => number - 1)];
    }),
  );
}
