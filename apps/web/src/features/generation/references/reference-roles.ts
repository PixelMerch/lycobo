import { type ReferenceRole, referenceRoleSchema } from "@lycoboai/contracts";
import { create } from "zustand";

/** 参考图的三种角色，顺序即菜单顺序：商品保持外观不变、原图逐张对应处理、风格只借鉴观感。 */
export const referenceRoles = referenceRoleSchema.options;

type RoleState = {
  roles: Record<string, ReferenceRole>;
  setRole: (id: string, role: ReferenceRole) => void;
};

/**
 * 本次会话里每张参考图的角色，按图片 id 记录，不写进草稿。
 * 单独存放是为了改角色时不替换参考图数组，套图计划不会因此清空已确认的方案。
 */
export const useReferenceRoles = create<RoleState>((set) => ({
  roles: {},
  setRole: (id, role) => set((state) => ({ roles: { ...state.roles, [id]: role } })),
}));

/** 读取一张参考图的角色；没设置过时按商品处理。 */
export function roleOf(roles: Record<string, ReferenceRole>, id: string): ReferenceRole {
  return roles[id] ?? "product";
}

/**
 * 提交时按参考图顺序给出角色。全部是默认的商品时返回 undefined，
 * 请求与加角色之前完全一样，不改变没用到角色的任务。
 */
export function submissionReferenceRoles(references: readonly { id: string }[]) {
  const { roles } = useReferenceRoles.getState();
  const list = references.map((image) => roleOf(roles, image.id));
  return list.some((role) => role !== "product") ? list : undefined;
}
