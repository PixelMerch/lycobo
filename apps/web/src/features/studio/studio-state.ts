import { create } from "zustand";

export const models = [
  {
    id: "gpt-image-2.5",
    name: "gpt-image-2.5",
    image: "bedroom",
    description: "上传参考图，描述想要的画面",
  },
  {
    id: "gpt-image-2.5-flare",
    name: "gpt-image-2.5-flare",
    image: "lavender",
    description: "上传参考图，描述想要的画面",
  },
  {
    id: "gpt-image-2.5-sunburst",
    name: "gpt-image-2.5-sunburst",
    image: "set",
    description: "上传参考图，描述想要的画面",
  },
  {
    id: "gpt-image-2",
    name: "gpt-image-2",
    image: "bedroom",
    description: "上传参考图，描述想要的画面",
  },
  {
    id: "gpt-image-2-4K",
    name: "gpt-image-2-4K",
    image: "set",
    description: "上传参考图，描述想要的画面",
  },
] as const;
export type ModelId = (typeof models)[number]["id"];
export const isModelId = (value: unknown): value is ModelId =>
  models.some((model) => model.id === value);
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
export type ReferenceImage = { id: string; name: string; src: string; assetId?: string };
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
  resolution: "1K",
  quality: "标准",
  count: "1",
});

// Client interaction only. No persisted tasks, paid submissions, or simulated completion.
export const useStudioStore = create<{
  chooserOpen: boolean;
  setChooserOpen: (open: boolean) => void;
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
  chooserOpen: false,
  setChooserOpen: (chooserOpen) => set({ chooserOpen }),
  activeHistoryId: null,
  setActiveHistoryId: (activeHistoryId) => set({ activeHistoryId }),
  activeModel: "gpt-image-2",
  setActiveModel: (activeModel) => set({ activeModel }),
  drafts: {
    "gpt-image-2.5": emptyDraft(),
    "gpt-image-2.5-flare": emptyDraft(),
    "gpt-image-2.5-sunburst": emptyDraft(),
    "gpt-image-2": emptyDraft(),
    "gpt-image-2-4K": emptyDraft(),
  },
  updateDraft: (model, patch) =>
    set((state) => ({
      drafts: { ...state.drafts, [model]: { ...state.drafts[model], ...patch } },
    })),
  addReferences: (model, references) =>
    set((state) => ({
      drafts: {
        ...state.drafts,
        [model]: {
          ...state.drafts[model],
          references: [...state.drafts[model].references, ...references].slice(0, 5),
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

/**
 * 首页灵感素材：由已登记的样例图片与派生视频片段组成，
 * 只用于展示版式与复用提示词，不代表任何用户的生成结果。
 */
export type ShowcaseItem = {
  id: string;
  kind: "image" | "video";
  title: string;
  meta: string;
  image: string;
  video?: string;
  caseId: (typeof cases)[number]["id"];
};
export const showcase: ShowcaseItem[] = [
  {
    id: "oak",
    kind: "image",
    title: "原木卧室",
    meta: "场景图",
    image: "bedroom",
    caseId: "oak",
  },
  {
    id: "set-motion",
    kind: "video",
    title: "套件质感",
    meta: "视频 · 4 秒",
    image: "set",
    video: "set-detail",
    caseId: "set",
  },
  {
    id: "purple",
    kind: "image",
    title: "浅紫配色",
    meta: "换色",
    image: "lavender",
    caseId: "purple",
  },
  {
    id: "bedroom-motion",
    kind: "video",
    title: "卧室运镜",
    meta: "视频 · 4 秒",
    image: "bedroom",
    video: "bedroom-detail",
    caseId: "oak",
  },
  {
    id: "cream",
    kind: "image",
    title: "奶油白三件套",
    meta: "图文",
    image: "set",
    caseId: "cream",
  },
  {
    id: "lavender-motion",
    kind: "video",
    title: "花型特写",
    meta: "视频 · 4 秒",
    image: "lavender",
    video: "lavender-detail",
    caseId: "purple",
  },
];
export const showcasePrompt = (item: ShowcaseItem) =>
  cases.find((entry) => entry.id === item.caseId)?.prompt ?? "";
