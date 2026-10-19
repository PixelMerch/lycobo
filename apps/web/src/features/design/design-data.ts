import { create } from "zustand";
import { formatReferencePrompt, parseReferencePrompt } from "./reference-prompt";

export const products = [
  {
    id: "skincare",
    title: "夏日护肤",
    category: "美妆个护",
    description: "把商品放在夏日泳池边，通透自然光，保留产品造型和包装。",
    shot: 0,
  },
  {
    id: "perfume",
    title: "琥珀香氛",
    category: "美妆个护",
    description: "暖调石台上的香水，午后阳光，突出玻璃质感。",
    shot: 1,
  },
  {
    id: "sneaker",
    title: "户外运动鞋",
    category: "服饰鞋包",
    description: "运动鞋放在林间苔藓石头上，户外自然光，突出鞋面细节。",
    shot: 2,
  },
  {
    id: "bag",
    title: "皮包光影",
    category: "服饰鞋包",
    description: "酒红色皮包与粉色建筑背景，保留皮革纹理，柔和侧光。",
    shot: 3,
  },
] as const;
export type GenerationSettings = {
  model: string;
  ratio: string;
  resolution: string;
  count: string;
};
export type ReferenceImage = { id: string; number: number; name: string } & (
  | { src: string; shot?: never }
  | { shot: number; src?: never }
);
export type ReferenceUpload = { id: string; name: string; src: string };
export type DemoTask = {
  createdAt?: string;
  references?: ReferenceImage[];
  settings?: GenerationSettings;
  id: string;
  title: string;
  prompt: string;
  shot: number;
  status: "生成中" | "排队中" | "已完成" | "部分失败";
  unread: boolean;
};
const initialTasks: DemoTask[] = [
  {
    id: "demo-shoe",
    title: "户外运动鞋",
    prompt: products[2].description,
    shot: 2,
    status: "生成中",
    unread: false,
  },
  {
    id: "demo-perfume",
    title: "琥珀香氛",
    prompt: products[1].description,
    shot: 1,
    status: "排队中",
    unread: false,
  },
  {
    id: "demo-skin",
    title: "夏日护肤",
    prompt: products[0].description,
    shot: 0,
    status: "已完成",
    unread: true,
  },
  {
    id: "demo-bag",
    title: "皮包光影",
    prompt: products[3].description,
    shot: 3,
    status: "部分失败",
    unread: false,
  },
];
// Isolated, deliberately ephemeral design fixtures. Never call production task APIs here.
export const useDesignStore = create<{
  tasks: DemoTask[];
  settings: GenerationSettings;
  setSettings: (settings: Partial<GenerationSettings>) => void;
  references: ReferenceImage[];
  addReferences: (images: ReferenceUpload[]) => void;
  removeReference: (id: string) => void;
  setReferences: (images: ReferenceImage[]) => void;
  prompt: string;
  shot: number;
  setDraft: (prompt: string, shot?: number) => void;
  addTask: () => string;
  markRead: (id: string) => void;
  completeDemo: () => void;
}>((set, get) => ({
  tasks: initialTasks,
  settings: { model: "香蕉 2.1版", ratio: "1:1", resolution: "2K", count: "1张" },
  setSettings: (settings) => set((state) => ({ settings: { ...state.settings, ...settings } })),
  references: [{ id: "reference-skincare", number: 1, name: "夏日护肤", shot: 0 }],
  setReferences: (references) => set({ references: references.slice(0, 5) }),
  addReferences: (images) =>
    set((state) => {
      const references = [...state.references];
      for (const image of images.slice(0, 5 - references.length)) {
        const number = [1, 2, 3, 4, 5].find((n) => !references.some((r) => r.number === n));
        if (number !== undefined) references.push({ ...image, number });
      }
      return { references };
    }),
  removeReference: (id) =>
    set((state) => {
      const { selected, description } = parseReferencePrompt(state.prompt, state.references);
      return {
        references: state.references.filter((r) => r.id !== id),
        prompt: formatReferencePrompt(
          selected.filter((image) => image.id !== id),
          description,
        ),
      };
    }),
  prompt: "",
  shot: 0,
  setDraft: (prompt, shot) =>
    set({
      prompt,
      ...(shot === undefined
        ? {}
        : {
            shot,
            references: [
              { id: `reference-${shot}`, number: 1, name: products[shot]?.title ?? "参考图", shot },
            ],
          }),
    }),
  addTask: () => {
    const id = `demo-${crypto.randomUUID()}`;
    const { prompt, shot, settings, references } = get();
    set((state) => ({
      tasks: [
        {
          id,
          createdAt: new Date().toISOString(),
          title: products[shot]?.title ?? "新商品",
          prompt,
          shot,
          settings: { ...settings },
          references: references.map((image) => ({ ...image })),
          status: "排队中",
          unread: false,
        },
        ...state.tasks,
      ],
      prompt: "",
    }));
    return id;
  },
  markRead: (id) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, unread: false } : t)),
    })),
  completeDemo: () =>
    set((state) => {
      const target = state.tasks.find((t) => t.status === "生成中" || t.status === "排队中");
      return {
        tasks: state.tasks.map((t) =>
          t.id === target?.id ? { ...t, status: "已完成", unread: true } : t,
        ),
      };
    }),
}));
