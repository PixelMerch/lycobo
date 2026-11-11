import { describe, expect, it } from "vitest";
import { shiftReplicaPromptReferences } from "./replica-state";

describe("复制爆款引用编号", () => {
  it("提交时跳过风格图的位置，重新编辑时恢复商品图编号", () => {
    const prompt = "保留 @图片1 和 @图片10 的颜色";
    const submitted = shiftReplicaPromptReferences(prompt, 1);
    expect(submitted).toBe("保留 @图片2 和 @图片11 的颜色");
    expect(shiftReplicaPromptReferences(submitted, -1)).toBe(prompt);
  });
});
