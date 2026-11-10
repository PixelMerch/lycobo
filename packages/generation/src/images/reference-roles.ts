import type { ImageGenerationInput, ReferenceRole } from "@lycoboai/contracts";

// 发给模型的角色说明；只有用户标了原图或风格（任务带 referenceRoles）时才加在提示词前面。
const roleRules: Record<ReferenceRole, string> = {
  product: "商品图，严格保持商品的外观、颜色、花型、结构和文字不变",
  source: "本张要处理的原图，在这张图的基础上完成要求",
  style: "只作风格参考，只借鉴光线、色调和构图，不复制其中的商品或文字",
};

/**
 * 一条输出实际要发送的参考图：套图计划的方案指定了参考图时只发这些（保持任务里的原顺序），
 * 否则沿用旧行为，发送任务的全部参考图。
 */
export function itemReferenceAssetIds(input: ImageGenerationInput, position: number): string[] {
  if (input.replica) {
    // 旧版双图任务可能要求多张输出，保留其原始快照语义。
    if (input.referenceAssetIds.length === 2) return input.referenceAssetIds;
    const target = input.referenceAssetIds[0];
    const product = input.referenceAssetIds[position + 1];
    if (!target || !product) throw new Error("REPLICA_POSITION_INVALID");
    return [target, product];
  }
  const chosen = input.variation?.items[position]?.referenceAssetIds;
  if (!chosen) return input.referenceAssetIds;
  const wanted = new Set(chosen);
  return input.referenceAssetIds.filter((id) => wanted.has(id));
}

/**
 * 按实际发送顺序说明每张图的角色，并对应回提示词里的“参考图N”和“@图片N”编号，
 * 模型就不会把共用的商品图和本条的原图弄混。任务没有角色时返回空字符串，提示词与旧任务一致。
 */
export function referenceRoleNotes(input: ImageGenerationInput, sentIds: readonly string[]) {
  const roles = input.referenceRoles;
  if (!roles) return "";
  const lines = sentIds.flatMap((id, index) => {
    const number = input.referenceAssetIds.indexOf(id) + 1;
    const role = roles[number - 1];
    return role
      ? [`第${index + 1}张图片是参考图${number}（@图片${number}）：${roleRules[role]}。`]
      : [];
  });
  return lines.length ? `参考图说明（按发送顺序）：\n${lines.join("\n")}` : "";
}
