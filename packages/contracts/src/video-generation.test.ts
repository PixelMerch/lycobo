import { expect, it } from "vitest";
import { videoInputSchema, videoUnitCredits } from "./video-generation";

it("video accepts text-only requests and every supported integer duration for the same 100 credits", () => {
  for (const seconds of [10, 15, 20, 30])
    expect(videoInputSchema.parse({ prompt: "画面缓慢推进", seconds }).seconds).toBe(seconds);
  expect(videoUnitCredits).toBe(100);
  for (const seconds of [5, 12, 31, 10.5, NaN])
    expect(videoInputSchema.safeParse({ prompt: "视频", seconds }).success).toBe(false);
  expect(videoInputSchema.safeParse({ prompt: "@图片1", seconds: 10 }).success).toBe(false);
  expect(
    videoInputSchema.safeParse({ prompt: "视频", seconds: 10, resolution: "1080p" }).success,
  ).toBe(false);
});
