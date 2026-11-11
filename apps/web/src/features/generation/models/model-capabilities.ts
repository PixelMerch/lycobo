import { type imageModelsResponseSchema, publicImageModel } from "@lycoboai/contracts";

type ModelsResponse = ReturnType<typeof imageModelsResponseSchema.parse>;

/** 工具能力优先，旧响应才使用全局编辑开关和默认容量。 */
export function modelCapabilities(
  data: ModelsResponse | undefined,
  model: string,
  tool: "create" | "textile-set" | "local-edit" | "replica",
) {
  if (!data?.enabled) return undefined;
  const candidates = data.tools ? data.tools[tool] : data.models;
  const match =
    candidates?.find((entry) => entry.id === model) ??
    candidates?.find((entry) => entry.id === publicImageModel(model));
  if (!match) return undefined;
  let defaultMaxReferences = tool === "textile-set" ? 6 : 5;
  if (tool === "replica") defaultMaxReferences = 11;
  return {
    enabledResolutions: match.enabledResolutions,
    editsEnabled:
      "editsEnabled" in match && typeof match.editsEnabled === "boolean"
        ? match.editsEnabled
        : data.editsEnabled,
    maxReferences:
      "maxReferences" in match && typeof match.maxReferences === "number"
        ? match.maxReferences
        : defaultMaxReferences,
  };
}

export function supportsReferences(
  capabilities: ReturnType<typeof modelCapabilities>,
  count: number,
) {
  return count === 0 || (!!capabilities?.editsEnabled && count <= capabilities.maxReferences);
}
