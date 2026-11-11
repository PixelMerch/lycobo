import { imageGenerationInputSchema } from "@lycoboai/contracts";
import { expect, it } from "vitest";
import { displayPrompt, userHistoryPrompt } from "./prompt-display";

const input = imageGenerationInputSchema.parse({ model: "gpt-image-2.6", prompt: "用户要求" });

it("复制爆款历史仅展示最终补充要求，并保留多行文字", () => {
  expect(
    userHistoryPrompt({
      prompt: "系统模板规则\n优化后的补充要求\n保留颜色",
      input: { ...input, replica: true },
    }),
  ).toBe("优化后的补充要求\n保留颜色");
});

it("未填写补充要求的复制爆款历史返回空文本", () => {
  for (const prompt of ["系统模板规则", "系统模板规则\n"]) {
    expect(userHistoryPrompt({ prompt, input: { ...input, replica: true } })).toBe("");
  }
});

it("旧家纺历史隐藏模型自动生成的说明，有独立用户内容时优先显示", () => {
  const textileInput = { ...input, textileSet: { version: 5 as const, views: [] } };
  const job = { prompt: "家纺主图裂变：正面。每个视角分别生成一张图片。", input: textileInput };
  expect(userHistoryPrompt(job)).toBe("");
  expect(userHistoryPrompt({ ...job, user_prompt: "保留商品颜色" })).toBe("保留商品颜色");
});

it("历史优先采用独立字段，并把空字符串视为已保存", () => {
  const job = {
    prompt: "模型说明\n模型参考图编号 @图片2",
    input: { ...input, replica: true as const },
  };
  expect(userHistoryPrompt({ ...job, user_prompt: "用户最终确认 @图片1" })).toBe(
    "用户最终确认 @图片1",
  );
  expect(userHistoryPrompt({ ...job, user_prompt: "" })).toBe("");
});

it("主图和套图历史保留提交的最终文字，不做翻译或重新优化", () => {
  expect(userHistoryPrompt({ prompt: "优化后第一行\n第二行", input })).toBe("优化后第一行\n第二行");
  expect(userHistoryPrompt({ prompt: "Keep the original product", input })).toBe(
    "Keep the original product",
  );
  expect(userHistoryPrompt({ prompt: "家纺裂变", input })).toBe("家纺裂变");
});

it("素材展示仍支持家纺固定名称的本地化", () => {
  expect(displayPrompt("家纺裂变", "en")).toBe("Textile Set");
});
