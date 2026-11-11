import { imageGenerationInputSchema, type ReferenceRole } from "@lycoboai/contracts";
import { describe, expect, it } from "vitest";
import { textileItemInput } from "./textile-generation";

const product = crypto.randomUUID();
const sourceA = crypto.randomUUID();
const sourceB = crypto.randomUUID();
const planItem = (prompt: string, referenceAssetIds?: string[]) => ({
  id: crypto.randomUUID(),
  title: "西语版",
  prompt,
  ...(referenceAssetIds ? { referenceAssetIds } : {}),
});
const planInput = (items: ReturnType<typeof planItem>[], referenceRoles?: ReferenceRole[]) =>
  imageGenerationInputSchema.parse({
    model: "gpt-image-2.5",
    prompt: "把每张详情图翻译成西班牙语",
    count: items.length,
    referenceAssetIds: [product, sourceA, sourceB],
    ...(referenceRoles ? { referenceRoles } : {}),
    variation: { version: 1, planId: crypto.randomUUID(), items },
  });

describe("reference roles and plan item bindings", () => {
  it("keeps saved plan items unchanged: every image is sent and the prompt has no notes", () => {
    const item = textileItemInput(planInput([planItem("把参考图2翻译成西班牙语")]), 0);
    expect(item.referenceAssetIds).toEqual([product, sourceA, sourceB]);
    expect(item.prompt).toBe(
      "把参考图2翻译成西班牙语\n只生成一张独立图片，不拼图。输出比例：1:1。",
    );
  });

  it("sends each plan item only the shared image and its own source, in task order", () => {
    const input = planInput(
      [
        planItem("把参考图2翻译成西班牙语", [sourceA, product]),
        planItem("把参考图3翻译成西班牙语", [sourceB, product]),
      ],
      ["product", "source", "source"],
    );
    const first = textileItemInput(input, 0);
    expect(first.referenceAssetIds).toEqual([product, sourceA]);
    expect(first.prompt).toContain("第1张图片是参考图1（@图片1）：商品图");
    expect(first.prompt).toContain("第2张图片是参考图2（@图片2）：本张要处理的原图");
    expect(first.prompt).not.toContain("参考图3（");
    const second = textileItemInput(input, 1);
    expect(second.referenceAssetIds).toEqual([product, sourceB]);
    expect(second.prompt).toContain("第2张图片是参考图3（@图片3）：本张要处理的原图");
    expect(second.prompt.endsWith("输出比例：1:1。")).toBe(true);
    expect("referenceRoles" in second).toBe(false);
  });

  it("maps auto-matched plan images back to their numbers without adding role rules", () => {
    // 网页按提示词自动对应原图时不带角色：只说明顺序与编号，不加“保持颜色不变”这类要求。
    const input = planInput([
      planItem("将参考图3调整为9:16竖版", [sourceB]),
      planItem("把参考图1的商品放进参考图2的场景", [product, sourceA]),
    ]);
    const first = textileItemInput(input, 0);
    expect(first.referenceAssetIds).toEqual([sourceB]);
    expect(first.prompt).toBe(
      "参考图说明（按发送顺序）：\n第1张图片是参考图3（@图片3）。\n将参考图3调整为9:16竖版\n只生成一张独立图片，不拼图。输出比例：1:1。",
    );
    const second = textileItemInput(input, 1);
    expect(second.referenceAssetIds).toEqual([product, sourceA]);
    expect(second.prompt).toContain(
      "第1张图片是参考图1（@图片1）。\n第2张图片是参考图2（@图片2）。",
    );
    expect(second.prompt).not.toContain("商品图");
  });

  it("adds role notes to an ordinary task only when roles were submitted", () => {
    const plain = imageGenerationInputSchema.parse({
      model: "gpt-image-2",
      prompt: "白底主图",
      referenceAssetIds: [product, sourceA],
    });
    expect(textileItemInput(plain, 0)).toBe(plain);
    const styled = textileItemInput({ ...plain, referenceRoles: ["product", "style"] }, 0);
    expect(styled.prompt).toMatch(/^参考图说明（按发送顺序）：\n第1张图片是参考图1/);
    expect(styled.prompt).toContain("第2张图片是参考图2（@图片2）：只作风格参考");
    expect(styled.prompt.endsWith("白底主图")).toBe(true);
    expect(styled.referenceAssetIds).toEqual([product, sourceA]);
  });
});

it("splits ten style matches into target/product pairs and rejects mismatched billing counts", () => {
  const ids = Array.from({ length: 11 }, () => crypto.randomUUID());
  const raw = {
    model: "gpt-image-2.6",
    prompt: "保持商品",
    replica: true,
    referenceAssetIds: ids,
    referenceRoles: ["style", ...Array(10).fill("product")],
    count: 10,
  };
  const input = imageGenerationInputSchema.parse(raw);
  for (let index = 0; index < 10; index++) {
    const output = textileItemInput(input, index);
    expect(output.referenceAssetIds).toEqual([ids[0], ids[index + 1]]);
    expect(output.count).toBe(1);
    expect(output.prompt).toContain("第1张图片是参考图1（@图片1）：风格图");
    expect(output.prompt).toContain(`第2张图片是参考图${index + 2}（@图片${index + 2}）：商品图`);
    expect(output.prompt).not.toContain("不复制其中的商品或文字");
    expect(output.prompt).toMatch(/保持商品$/);
  }
  expect(imageGenerationInputSchema.safeParse({ ...raw, count: 1 }).success).toBe(false);
  expect(imageGenerationInputSchema.safeParse({ ...raw, replica: undefined }).success).toBe(false);
});
