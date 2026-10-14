import { create } from "zustand";
// Session-local draft only. Persistent server drafts are a later authenticated feature.
export const useDraftStore = create<{ prompt: string; setPrompt: (prompt: string) => void }>(
  (set) => ({
    prompt: "",
    setPrompt: (prompt) => set({ prompt }),
  }),
);
