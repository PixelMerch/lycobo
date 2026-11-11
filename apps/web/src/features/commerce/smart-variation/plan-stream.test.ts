import { beforeEach, describe, expect, it } from "vitest";
import { useLocaleStore } from "../../../i18n/locale-store";
import { previewPlanItems, readPlanResponse } from "./plan-stream";

// 断言按中文文案编写，固定界面语言。
beforeEach(() => useLocaleStore.setState({ locale: "zh-CN" }));

describe("plan stream preview", () => {
  it("shows unfinished prompts and preserves escaped quotes across chunks", () => {
    const text = '{"items":[{"title":"橙色款","prompt":"保留\\"花纹\\"，场景';
    expect(previewPlanItems(text)).toMatchObject([{ title: "橙色款", prompt: '保留"花纹"，场景' }]);
    expect(previewPlanItems(text)[0]?.id).toBe(previewPlanItems(`${text}自然"}]}`)[0]?.id);
  });
  it("handles split unicode escapes and ignores JSON keys inside escaped strings", () => {
    expect(previewPlanItems('{"items":[{"title":"商品","prompt":"白色\\u4e')).toMatchObject([
      { title: "商品", prompt: "白色" },
    ]);
    expect(
      previewPlanItems('{"items":[{"title":"商品","prompt":"\\"title\\":\\"测试\\""}]}'),
    ).toHaveLength(1);
  });
  it("never treats a disconnected stream as a saved plan", async () => {
    const parts: string[] = [];
    const response = new Response('event: delta\ndata: {"text":"部分内容"}\n\n', {
      headers: { "content-type": "text/event-stream" },
    });
    await expect(readPlanResponse(response, (text) => parts.push(text))).rejects.toThrow(
      "连接已中断",
    );
    expect(parts).toEqual(["部分内容"]);
  });
});
