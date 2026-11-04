import { createContext, useContext } from "react";
import type { useStoryboard } from "./use-storyboard";

export const StoryboardContext = createContext<ReturnType<typeof useStoryboard> | null>(null);

export function useStoryboardWorkspace() {
  const storyboard = useContext(StoryboardContext);
  if (!storyboard) throw new Error("Storyboard workspace is unavailable");
  return storyboard;
}
