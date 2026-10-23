import { create } from "zustand";
export type ImageEventStatus = "off" | "connecting" | "live" | "fallback";
export const useImageEventState = create<{
  status: ImageEventStatus;
  setStatus: (status: ImageEventStatus) => void;
}>((set) => ({
  status: "off",
  setStatus: (status) => set({ status }),
}));
