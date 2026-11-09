import type { Locale } from "../../../i18n/locale";
import { modelMessages } from "./model-messages";

type PresentedModelId = keyof (typeof modelMessages)[Locale]["models"];

const presentedModels: { id: PresentedModelId; name: string; logoUrl: string }[] = [
  { id: "gpt-image-2.6", name: "Image 2.6", logoUrl: "/model-logos/openai.svg" },
  { id: "gpt-image-2", name: "Image 2", logoUrl: "/model-logos/openai.svg" },
  { id: "gpt-image-2.5", name: "Image 2.5", logoUrl: "/model-logos/openai.svg" },
  { id: "nano-banana-2.1", name: "Banana 2.1", logoUrl: "/model-logos/google.svg" },
  { id: "gemini-3-pro-image-preview", name: "Banana Pro", logoUrl: "/model-logos/google.svg" },
];

/** 主站自带的模型展示资料（名称、Logo 与当前语言的用途说明），与后台目录和渠道开关无关。 */
export function modelPresentationFor(locale: Locale) {
  const text = modelMessages[locale].models;
  return {
    models: presentedModels.map((model) => ({
      ...model,
      description: text[model.id].description,
      capabilitySummary: text[model.id].summary,
    })),
  };
}
