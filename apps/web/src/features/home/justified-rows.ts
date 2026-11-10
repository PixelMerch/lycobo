/** 等高行拼图里的一行：第 start 张到第 end 张之前，行高 height 像素。 */
export type JustifiedRow = {
  start: number;
  end: number;
  height: number;
  /** 是否左右占满；只有图片太少、占满会超过最高行高时为 false，此时按 height 靠左排。 */
  filled: boolean;
};

type RowOptions = {
  /** 容器宽度（像素）。 */
  width: number;
  /** 图片之间的间距（像素）。 */
  gap: number;
};

/** 按容器宽度取目标行高：手机约两张一行，桌面约五张一行，最高 300px。 */
export function targetRowHeight(width: number) {
  return Math.min(300, Math.max(180, Math.round(width * 0.22)));
}

/** 一行左右占满时的行高：扣掉间距后的宽度，除以这一行宽高比之和。 */
function filledHeight(aspects: readonly number[], start: number, end: number, options: RowOptions) {
  let aspectSum = 0;
  for (let index = start; index < end; index += 1) aspectSum += aspects[index] ?? 1;
  return (options.width - options.gap * (end - start - 1)) / aspectSum;
}

/**
 * 按原顺序把图片分成若干行，每行左右占满、行内等高（宽高比 = 宽 ÷ 高）。
 * 用动态规划挑断行位置，让各行行高与目标行高的偏差平方和最小，所以最后一行也占满；
 * 只有图片太少、占满会超过目标行高 1.8 倍时，那一行改为按 1.8 倍行高靠左排。
 */
export function justifyRows(aspects: readonly number[], options: RowOptions): JustifiedRow[] {
  const count = aspects.length;
  if (count === 0 || options.width <= 0) return [];
  const target = targetRowHeight(options.width);
  // cost[end]：前 end 张排好时的最小偏差；rowStart[end]：此时最后一行从第几张开始。
  const cost = [0];
  const rowStart = [0];
  for (let end = 1; end <= count; end += 1) {
    cost[end] = Number.POSITIVE_INFINITY;
    for (let start = 0; start < end; start += 1) {
      const height = filledHeight(aspects, start, end, options);
      const total = (cost[start] ?? Number.POSITIVE_INFINITY) + (height - target) ** 2;
      if (height > 0 && total < (cost[end] ?? Number.POSITIVE_INFINITY)) {
        cost[end] = total;
        rowStart[end] = start;
      }
    }
  }
  const maxHeight = target * 1.8;
  const rows: JustifiedRow[] = [];
  let end = count;
  // 从最后一张往前，沿记下的断行位置还原每一行。
  while (end > 0) {
    const start = rowStart[end] ?? 0;
    const height = filledHeight(aspects, start, end, options);
    rows.unshift({ start, end, height: Math.min(height, maxHeight), filled: height <= maxHeight });
    end = start;
  }
  return rows;
}
