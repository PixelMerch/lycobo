import { useSyncExternalStore } from "react";
import type { HomeInspiration } from "./home-inspiration-data";

const breakpoints = ["(min-width: 768px)", "(min-width: 1200px)", "(min-width: 1800px)"];

function subscribe(onChange: () => void) {
  const queries = breakpoints.map((query) => window.matchMedia(query));
  for (const query of queries) query.addEventListener("change", onChange);
  return () => {
    for (const query of queries) query.removeEventListener("change", onChange);
  };
}

function getColumnCount() {
  return 2 + breakpoints.filter((query) => window.matchMedia(query).matches).length;
}

/** Fill the shortest column rather than leaving the final CSS multi-column track empty. */
export function useInspirationColumns(items: HomeInspiration[]) {
  const count = useSyncExternalStore(subscribe, getColumnCount, () => 4);
  const columns = Array.from(
    { length: count },
    (_, index): { id: string; items: HomeInspiration[]; height: number } => ({
      id: `inspiration-column-${index}`,
      items: [],
      height: 0,
    }),
  );
  for (const item of items) {
    const shortest = columns.reduce((left, right) => (left.height <= right.height ? left : right));
    shortest.items.push(item);
    const ratio = item.shape === "portrait" ? 1.25 : item.shape === "landscape" ? 0.75 : 1;
    shortest.height += ratio + 0.06;
  }
  return columns;
}
