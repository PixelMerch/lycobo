import { useSyncExternalStore } from "react";

const query = "(min-width: 768px)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const getSnapshot = () => window.matchMedia(query).matches;
const getServerSnapshot = () => true;

/** True from the tablet breakpoint up; settings switch from top tabs to a side list there. */
export function useWideViewport() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
