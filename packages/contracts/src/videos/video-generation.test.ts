import { expect, it } from "vitest";
import { videoInputSchema, videoUnitCredits } from "./video-generation";

it("video accepts text-only requests and every supported integer duration for the same 100 credits", () => {
  for (const seconds of Array.from({ length: 26 }, (_, index) => index + 5))
    expect(videoInputSchema.parse({ prompt: "画面缓慢推进", seconds }).seconds).toBe(seconds);
  expect(videoUnitCredits).toBe(100);
  for (const seconds of [4, 31, 10.5, NaN])
    expect(videoInputSchema.safeParse({ prompt: "视频", seconds }).success).toBe(false);
  expect(videoInputSchema.safeParse({ prompt: "@图片1", seconds: 10 }).success).toBe(false);
  expect(
    videoInputSchema.safeParse({ prompt: "视频", seconds: 10, resolution: "1080p" }).success,
  ).toBe(false);
});

it("accepts 5000 scene-description characters and rejects 5001", () => {
  expect(videoInputSchema.safeParse({ prompt: "景".repeat(5000), seconds: 18 }).success).toBe(true);
  expect(videoInputSchema.safeParse({ prompt: "景".repeat(5001), seconds: 18 }).success).toBe(
    false,
  );
});
