import { LoadingState } from "../components/loading-state";

/** Route-level fallback shown while lazy pages load. */
export function PageLoading() {
  return <LoadingState />;
}
