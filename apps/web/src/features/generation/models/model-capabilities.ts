import { type imageModelsResponseSchema, publicImageModel } from "@lycoboai/contracts";

type ModelsResponse = ReturnType<typeof imageModelsResponseSchema.parse>;

/** Tool capabilities are authoritative; the global edit flag only supports legacy responses. */
export function modelCapabilities(
  data: ModelsResponse | undefined,
  model: string,
  tool: "create" | "textile-set" | "local-edit",
) {
  if (!data?.enabled) return undefined;
  const candidates = data.tools ? data.tools[tool] : data.models;
  const match =
    candidates?.find((entry) => entry.id === model) ??
    candidates?.find((entry) => entry.id === publicImageModel(model));
  if (!match) return undefined;
  return {
    enabledResolutions: match.enabledResolutions,
    editsEnabled:
      "editsEnabled" in match && typeof match.editsEnabled === "boolean"
        ? match.editsEnabled
        : data.editsEnabled,
    maxReferences:
      "maxReferences" in match && typeof match.maxReferences === "number"
        ? match.maxReferences
        : tool === "textile-set"
          ? 6
          : 5,
  };
}

export function supportsReferences(
  capabilities: ReturnType<typeof modelCapabilities>,
  count: number,
) {
  return count === 0 || (!!capabilities?.editsEnabled && count <= capabilities.maxReferences);
}
