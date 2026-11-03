import { videoRatios } from "@lycoboai/contracts";
import { create } from "zustand";
import type { ReferenceImage } from "../generation/studio-state";

export { videoRatios };
export const videoPromptLimit = 800;
type VideoDraft = {
  firstFrame: ReferenceImage | null;
  lastFrame: ReferenceImage | null;
  extraReferences: ReferenceImage[];
  prompt: string;
  ratio: (typeof videoRatios)[number];
  seconds: number;
};
/** Retain the original two prepared images as ordered references when switching tools. */
export const useVideoDraft = create<VideoDraft & { update: (patch: Partial<VideoDraft>) => void }>(
  (set) => ({
    firstFrame: null,
    lastFrame: null,
    extraReferences: [],
    prompt: "",
    ratio: "9:16",
    seconds: 10,
    update: (patch) => set(patch),
  }),
);
