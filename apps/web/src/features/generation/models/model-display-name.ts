import { publicImageModel } from "@lycoboai/contracts";

/** Resolve presentation only; keep the original model identifier in task/editor state. */
export function modelDisplayName(
  id: string | null | undefined,
  models: readonly { id: string; name?: string | undefined }[],
) {
  if (!id) return "图片创作";
  const model =
    models.find((model) => model.id === id) ??
    models.find((model) => model.id === publicImageModel(id));
  const retiredNames: Record<string, string> = {
    "grok-imagine-image-2.0": "Grok 2",
    "seedream-5.0-pro": "Seedream 5.0 Pro",
  };
  return model?.name?.trim() || retiredNames[id] || "图片创作";
}
