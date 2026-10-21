import { describe, expect, it } from "vitest";
import {
  constrainRegion,
  type RepairRegion,
  repairOutput,
  repairPrompt,
} from "./local-repair-state";

const region: RepairRegion = {
  id: "one",
  x: 100,
  y: 200,
  width: 300,
  height: 400,
  prompt: "去掉脚袋",
};
describe("local repair image coordinates", () => {
  it("keeps moved and resized regions inside the original image", () => {
    expect(constrainRegion({ ...region, x: -40, y: 900, width: 1500 }, 1024, 1024)).toMatchObject({
      x: 0,
      y: 624,
      width: 1024,
      height: 400,
    });
    expect(constrainRegion({ ...region, width: -10, height: -20 }, 1024, 1024)).toMatchObject({
      width: 1,
      height: 1,
    });
  });
  it("pairs each instruction with its original pixel rectangle without drawing annotations", () => {
    const prompt = repairPrompt(
      [region, { ...region, id: "two", x: 20, prompt: "修改标题" }],
      2048,
      1024,
    );
    expect(prompt).toContain("2048×1024");
    expect(prompt).toContain("区域 1：左上角 (100, 200)，宽 300，高 400。修改要求：去掉脚袋");
    expect(prompt).toContain("区域 2：左上角 (20, 200)，宽 300，高 400。修改要求：修改标题");
    expect(prompt).toContain("不要绘制选框、编号或批注文字");
  });
  it("uses the closest supported output ratio and source resolution tier", () => {
    expect(repairOutput(2048, 1024)).toEqual({ ratio: "2:1", resolution: "2K" });
    expect(repairOutput(1024, 768)).toEqual({ ratio: "4:3", resolution: "1K" });
    expect(repairOutput(4096, 4096)).toEqual({ ratio: "1:1", resolution: "4K" });
  });
});
