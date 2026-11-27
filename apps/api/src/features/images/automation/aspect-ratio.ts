import { imageGenerationInputSchema } from "@lycoboai/contracts";

const aspectRatio = imageGenerationInputSchema.shape.aspectRatio.unwrap();
const ratioToken = /(?<![\d:：])\d{1,2}\s*[:：]\s*\d{1,2}(?![\d:：])/gu;
const ratioLabel =
  /(?:宽高比|画幅比例|图片比例|比例|\b(?:aspect\s+)?ratio)\s*(?:为|是|of|is|[=:：])?\s*$/iu;
const ratioFormat =
  /^\s*(?:横版|横屏|横向|竖版|竖屏|竖向|方图|方形|构图|宽高比|画幅比例|图片比例|\b(?:aspect\s+ratio|landscape|portrait|square)\b)/iu;

/** 从旧客户端的文字输入中识别唯一明确的受支持宽高比。 */
export function inferAutomationAspectRatio(prompts: readonly string[]) {
  const ratios = new Set<(typeof aspectRatio.options)[number]>();
  for (const prompt of prompts) {
    const text = prompt.trim();
    for (const { 0: token, index } of text.matchAll(ratioToken)) {
      if (
        token !== text &&
        !ratioLabel.test(text.slice(0, index)) &&
        !ratioFormat.test(text.slice(index + token.length))
      )
        continue;
      const parsed = aspectRatio.safeParse(token.replace(/\s/g, "").replace("：", ":"));
      if (parsed.success) ratios.add(parsed.data);
    }
  }
  return ratios.size === 1 ? ratios.values().next().value : undefined;
}
