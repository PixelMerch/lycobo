import { expect, it } from "vitest";
import { inferAutomationAspectRatio } from "./aspect-ratio";

it.each([
  { prompts: ["耳机产品图，宽高比为 16：9"], expected: "16:9" },
  { prompts: ["headphones, 16:9 landscape composition"], expected: "16:9" },
  { prompts: ["邮轮宣传图", "宽高比 9:16", "Aspect ratio: 9:16"], expected: "9:16" },
  { prompts: ["4:5"], expected: "4:5" },
  { prompts: ["海报上的时钟显示 2:3，不加边框"], expected: undefined },
  { prompts: ["16:9:30 landscape photo at sunset"], expected: undefined },
  { prompts: ["宽高比 16:9", "aspect ratio 9:16"], expected: undefined },
  { prompts: ["aspect ratio 7:5"], expected: undefined },
])("infers only one explicit supported aspect ratio from $prompts", ({ prompts, expected }) => {
  expect(inferAutomationAspectRatio(prompts)).toBe(expected);
});
