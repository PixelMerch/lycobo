import { create } from "zustand";
import type { ReferenceImage } from "../generation/studio-state";

export const videoRatios = ["16:9", "9:16", "1:1"] as const;
export const videoDurations = ["5 秒", "10 秒"] as const;
export const videoResolutions = ["720P", "1080P"] as const;
export const videoPromptLimit = 800;

type VideoDraft = {
  firstFrame: ReferenceImage | null;
  lastFrame: ReferenceImage | null;
  prompt: string;
  ratio: (typeof videoRatios)[number];
  duration: (typeof videoDurations)[number];
  resolution: (typeof videoResolutions)[number];
};

/**
 * Client interaction draft only. Video generation is not connected yet, so nothing here is
 * uploaded, submitted or charged; switching tools keeps the draft like the image tools.
 */
export const useVideoDraft = create<VideoDraft & { update: (patch: Partial<VideoDraft>) => void }>(
  (set) => ({
    firstFrame: null,
    lastFrame: null,
    prompt: "",
    ratio: "9:16",
    duration: "5 秒",
    resolution: "1080P",
    update: (patch) => set(patch),
  }),
);
