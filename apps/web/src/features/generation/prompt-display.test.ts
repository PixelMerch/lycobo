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

it("家纺历史隐藏固定标记，有用户内容时保留", () => {
  const textileInput = { ...input, textileSet: { version: 5 as const, views: [] } };
  expect(userHistoryPrompt({ prompt: "家纺裂变", input: textileInput })).toBe("");
  expect(userHistoryPrompt({ prompt: "保留商品颜色", input: textileInput })).toBe("保留商品颜色");
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
