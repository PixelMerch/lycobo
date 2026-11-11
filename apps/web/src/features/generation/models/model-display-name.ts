import { publicImageModel } from "@lycoboai/contracts";
import type { Locale } from "../../../i18n/locale";
import { modelMessages } from "./model-messages";

/** 只换算显示名称；任务与编辑状态里仍保存原始模型 id。找不到名称时显示“图片创作”。 */
export function modelDisplayName(
  id: string | null | undefined,
  models: readonly { id: string; name?: string | undefined }[],
  locale: Locale,
) {
  const fallback = modelMessages[locale].fallbackName;
  if (!id) return fallback;
  const model =
    models.find((model) => model.id === id) ??
    models.find((model) => model.id === publicImageModel(id));
  const retiredNames: Record<string, string> = {
    "grok-imagine-image-2.0": "Grok 2",
    "seedream-5.0-pro": "Seedream 5.0 Pro",
  };
  return model?.name?.trim() || retiredNames[id] || fallback;
}
