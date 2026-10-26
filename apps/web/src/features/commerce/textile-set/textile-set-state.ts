import { create } from "zustand";
import type { ReferenceImage } from "../../generation/studio-state";
import type { TextileViewId } from "./textile-views";

type TextileSetDraft = {
  mainImage: ReferenceImage | null;
  detailImages: ReferenceImage[];
  views: TextileViewId[];
  ratio: string;
};

/** Client interaction draft only; no generated results or durable uploads. */
export const useTextileSetDraft = create<
  TextileSetDraft & {
    update: (patch: Partial<TextileSetDraft>) => void;
  }
>((set) => ({
  mainImage: null,
  detailImages: [],
  views: [],
  ratio: "1:1",
  update: (patch) => set(patch),
}));
