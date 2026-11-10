import { imageJobSchema } from "@lycoboai/contracts";
import { expect, it } from "vitest";
import { historyResultRowStyle, historyResultUsesThumbnail } from "./history-result-layout";

function job(aspectRatio: string, sizes: (readonly [number, number] | null)[]) {
  return imageJobSchema.parse({
    id: crypto.randomUUID(),
    organization_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    model: "gpt-image-2.5",
    prompt: "fixture",
    resolution: "1K",
    aspect_ratio: aspectRatio,
    requested_count: sizes.length,
    status: "succeeded",
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    items: sizes.map((size, position) => ({
      id: crypto.randomUUID(),
      position,
      status: size ? "succeeded" : "running",
      output_asset_id: size ? crypto.randomUUID() : null,
      error_code: null,
      width: size?.[0] ?? null,
      height: size?.[1] ?? null,
      worker_id: null,
    })),
  });
}

it("fills one row with the first four images in a wide area and the first two in a narrow one", () => {
  const style = historyResultRowStyle(
    job("3:4", [[768, 1024], [768, 1024], null, [1024, 1024], [1024, 1024], [1024, 1024]]),
  );
  // 生成中的那张按请求比例 3:4 占位，第五张以后不影响第一行。
  expect(style["--result-wide-ratio"]).toBeCloseTo(0.75 * 3 + 1);
  expect(style["--result-wide-count"]).toBe(4);
  expect(style["--result-narrow-ratio"]).toBeCloseTo(1.5);
  expect(style["--result-narrow-count"]).toBe(2);
  expect(style["--result-max-ratio"]).toBe(1);
});

it("keeps a single wide image within the row and loads previews for small batches", () => {
  const single = job("16:9", [[1792, 1008]]);
  const style = historyResultRowStyle(single);
  expect(style["--result-max-ratio"]).toBeCloseTo(16 / 9);
  expect(style["--result-wide-count"]).toBe(1);
  expect(style["--result-narrow-count"]).toBe(1);
  expect(historyResultUsesThumbnail(single)).toBe(false);
  expect(historyResultUsesThumbnail(job("1:1", [null, null, null, null]))).toBe(true);
});
