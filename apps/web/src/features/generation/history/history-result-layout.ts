import type { ImageJob } from "@lycoboai/contracts";

/** Actual output dimensions win; pending/failed items retain the requested proportions. */
export function historyResultRatio(job: ImageJob, item: ImageJob["items"][number]) {
  if (item.width && item.height && item.width > 0 && item.height > 0)
    return item.width / item.height;
  const [width, height] = job.aspect_ratio.split(":").map(Number);
  return width && height && width > 0 && height > 0 ? width / height : 1;
}
