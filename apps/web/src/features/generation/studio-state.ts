import { imageModelCodeSchema } from "@lycoboai/contracts";
import { create } from "zustand";

export type ModelId = string;
export const isModelId = (value: unknown): value is ModelId =>
  imageModelCodeSchema.safeParse(value).success;
export const cases = [
  {
    id: "oak",
    title: "原木卧室",
    image: "bedroom",
    category: "场景",
    prompt: "将这套奶油白被子三件套放入原木卧室，保留菱格绗缝与两个枕套，自然采光，画面简洁。",
  },
  {
    id: "cream",
    title: "奶油白三件套",
    image: "set",
    category: "图文",
    prompt: "保留一条被子与两个枕套，使用干净的白色背景，清楚展示套件组成。",
  },
  {
    id: "purple",
    title: "浅紫配色",
    image: "lavender",
    category: "配色",
    prompt: "将被子与两个枕套调整为浅紫色，保留菱格绗缝和面料纹理。",
  },
  {
    id: "set",
    title: "套件展示",
    image: "set",
    category: "图文",
    prompt: "展示一条折叠被子与两个匹配枕套，柔和光线，突出绗缝与质感。",
  },
] as const;
export type StudioCase = (typeof cases)[number];
export type ReferenceImage = {
  id: string;
  name: string;
  src: string;
  assetId?: string;
  thumbnailSrc?: string;
  previewSrc?: string;
};
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
  quality: "标准",
  count: "1",
});

export const defaultDraft = emptyDraft();

// Client interaction only. No persisted tasks, paid submissions, or simulated completion.
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
  favorites: string[];
  toggleFavorite: (id: string) => void;
}>((set) => ({
  activeHistoryId: null,
  setActiveHistoryId: (activeHistoryId) => set({ activeHistoryId }),
  activeModel: "gpt-image-2",
  setActiveModel: (activeModel) =>
    set((state) => ({
      activeModel,
      drafts: { ...state.drafts, [activeModel]: state.drafts[activeModel] ?? emptyDraft() },
    })),
  drafts: {
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
  favorites: [],
  toggleFavorite: (id) =>
    set((state) => ({
      favorites: state.favorites.includes(id)
        ? state.favorites.filter((item) => item !== id)
        : [...state.favorites, id],
    })),
}));
export const photo = (image: string, thumbnail = false) =>
  `/studio/${image}${thumbnail ? "-thumb" : ""}.webp`;
