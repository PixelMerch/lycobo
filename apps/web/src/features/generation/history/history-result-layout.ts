import type { ImageJob } from "@lycoboai/contracts";
import type { CSSProperties } from "react";

/** Actual output dimensions win; pending/failed items retain the requested proportions. */
export function historyResultRatio(job: ImageJob, item: ImageJob["items"][number]) {
  if (item.width && item.height && item.width > 0 && item.height > 0)
    return item.width / item.height;
  const [width, height] = job.aspect_ratio.split(":").map(Number);
  return width && height && width > 0 && height > 0 ? width / height : 1;
}

/** 结果区的行高参数：宽结果区一行最多 4 张、窄结果区最多 2 张，CSS 按这一行的宽高比之和把行铺满。 */
export function historyResultRowStyle(job: ImageJob) {
  const ratios = job.items.map((item) => historyResultRatio(job, item));
  const rowRatio = (limit: number) =>
    ratios.slice(0, limit).reduce((sum, ratio) => sum + ratio, 0) || 1;
  const rowCount = (limit: number) => Math.min(limit, Math.max(1, ratios.length));
  const style: CSSProperties & Record<`--result-${string}`, number> = {
    // 最宽的一张决定高度上限，横图不会超出结果区。
    "--result-max-ratio": Math.max(1, ...ratios),
    "--result-wide-ratio": rowRatio(4),
    "--result-wide-count": rowCount(4),
    "--result-narrow-ratio": rowRatio(2),
    "--result-narrow-count": rowCount(2),
  };
  return style;
}

/** 1–3 张的任务最高显示到 480px，512px 缩略图会发虚，改用 1600px 预览图；4 张及以上用缩略图。 */
export function historyResultUsesThumbnail(job: ImageJob) {
  return job.requested_count > 3;
}
