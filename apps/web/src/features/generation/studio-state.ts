import { imageModelCodeSchema } from "@lycoboai/contracts";
import { create } from "zustand";

export type ModelId = string;
export const isModelId = (value: unknown): value is ModelId =>
  imageModelCodeSchema.safeParse(value).success;
export type ReferenceImage = {
  id: string;
  name: string;
  src: string;
  assetId?: string;
  sourceKind?: "reference" | "output";
  thumbnailSrc?: string;
  previewSrc?: string;
};
/** 生成质量的三个档位，取值直接用于接口请求；界面名称在 quality-messages.ts。 */
export const qualityLevels = ["low", "medium", "high"] as const;

export type Draft = {
  prompt: string;
  references: ReferenceImage[];
  ratio: string;
  resolution: string;
  quality: string;
  count: string;
};
const emptyDraft = (): Draft => ({
  prompt: "",
  references: [],
  ratio: "1:1",
  resolution: "1.5K",
  quality: "medium",
  count: "1",
});

export const defaultDraft = emptyDraft();

// 这里只保存客户端草稿；任务、扣费与完成状态均由服务端持久化。
export const useStudioStore = create<{
  activeHistoryId: string | null;
  setActiveHistoryId: (id: string) => void;
  activeModel: ModelId;
  setActiveModel: (model: ModelId) => void;
  drafts: Record<ModelId, Draft>;
  updateDraft: (model: ModelId, patch: Partial<Draft>) => void;
  addReferences: (model: ModelId, references: ReferenceImage[]) => void;
  recentModels: ModelId[];
  visitModel: (model: ModelId) => void;
}>((set) => ({
  activeHistoryId: null,
  setActiveHistoryId: (activeHistoryId) => set({ activeHistoryId }),
  activeModel: "gpt-image-2.6",
  setActiveModel: (activeModel) =>
    set((state) => ({
      activeModel,
      drafts: { ...state.drafts, [activeModel]: state.drafts[activeModel] ?? emptyDraft() },
    })),
  drafts: {
    "gpt-image-2.6": emptyDraft(),
    "gpt-image-2.5": emptyDraft(),
    "gpt-image-2": emptyDraft(),
    "nano-banana-2.1": emptyDraft(),
  },
  updateDraft: (model, patch) =>
    set((state) => ({
      drafts: { ...state.drafts, [model]: { ...(state.drafts[model] ?? emptyDraft()), ...patch } },
    })),
  addReferences: (model, references) =>
    set((state) => ({
      drafts: {
        ...state.drafts,
        [model]: {
          ...(state.drafts[model] ?? emptyDraft()),
          references: [...(state.drafts[model]?.references ?? []), ...references].slice(0, 5),
        },
      },
    })),
  recentModels: [],
  visitModel: (model) =>
    set((state) => ({ recentModels: [model, ...state.recentModels.filter((id) => id !== model)] })),
}));
export const photo = (image: string, thumbnail = false) =>
  `/studio/${image}${thumbnail ? "-thumb" : ""}.webp`;
