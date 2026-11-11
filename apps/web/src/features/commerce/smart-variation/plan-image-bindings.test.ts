import { describe, expect, it } from "vitest";
import { useReferenceRoles } from "../../generation/references/reference-roles";
import {
  itemReferenceIndexes,
  mentionedImageNumbers,
  planImages,
  planSubmissionRoles,
  planUsage,
} from "./plan-image-bindings";

const references = [{ id: "product" }, { id: "first" }, { id: "second" }];
const roles = { first: "source", second: "source" } as const;
const marked = planUsage(references, roles, []);

/** 没标角色时，按全部方案的提示词算出每条要发送的参考图下标。 */
function unmarkedIndexes(
  images: readonly { id: string }[],
  items: readonly { id: string; prompt: string }[],
) {
  const usage = planUsage(
    images,
    {},
    items.map((item) => item.prompt),
  );
  return itemReferenceIndexes(items, images, usage, {});
}

describe("plan image bindings", () => {
  it("binds each item to the shared images and the sources its prompt mentions", () => {
    const items = [
      { id: "a", prompt: "把参考图2中的文案翻译成西班牙语" },
      { id: "b", prompt: "把@图片3中的文案翻译成西班牙语" },
    ];
    expect(itemReferenceIndexes(items, references, marked, {})).toEqual({ a: [0, 1], b: [0, 2] });
  });

  it("uses a manual choice instead of the prompt mentions", () => {
    const items = [{ id: "a", prompt: "把参考图2翻译" }];
    expect(itemReferenceIndexes(items, references, marked, { a: [3] })).toEqual({ a: [0, 2] });
    expect(itemReferenceIndexes(items, references, marked, { a: [] })).toEqual({ a: [0] });
  });

  it("reads both the planner and the user mention styles", () => {
    expect([...mentionedImageNumbers("参考图2、@图片10 与参考图 3")]).toEqual([2, 10, 3]);
  });

  it("expands listed and ranged numbers but not counts, sizes or ratios", () => {
    expect([...mentionedImageNumbers("以参考图1-3中的商品为准")]).toEqual([1, 2, 3]);
    expect([...mentionedImageNumbers("参考图1至参考图4统一")]).toEqual([1, 2, 3, 4]);
    expect([...mentionedImageNumbers("参考图1、2和5")]).toEqual([1, 2, 5]);
    expect([...mentionedImageNumbers("参考图1，2个枕套不变，3D效果")]).toEqual([1]);
    expect([...mentionedImageNumbers("参考图1，9:16竖版")]).toEqual([1]);
  });
});

describe("unmarked references matched from the plan", () => {
  const five = ["a", "b", "c", "d", "e"].map((id) => ({ id }));

  it("sends each per-image item only its own picture", () => {
    // 第一个客户的真实用法：五张图各改成 9:16，以前每条都收到全部五张，结果五张都改成了第一张。
    const items = five.map((_, index) => ({
      id: `plan-${index + 1}`,
      prompt: `将参考图${index + 1}调整为9:16竖版构图，其他保持不变。`,
    }));
    expect(unmarkedIndexes(five, items)).toEqual({
      "plan-1": [0],
      "plan-2": [1],
      "plan-3": [2],
      "plan-4": [3],
      "plan-5": [4],
    });
  });

  it("shares the image every item names and pairs it with each item's own picture", () => {
    const items = [2, 3, 4].map((scene) => ({
      id: `scene-${scene}`,
      prompt: `把参考图1的商品放进参考图${scene}的场景`,
    }));
    expect(unmarkedIndexes(five, items)).toEqual({
      "scene-2": [0, 1],
      "scene-3": [0, 2],
      "scene-4": [0, 3],
    });
  });

  it("sends only the named picture when every item works on the same one", () => {
    const items = [
      { id: "red", prompt: "参考图2换成红色" },
      { id: "blue", prompt: "参考图2换成蓝色" },
    ];
    expect(unmarkedIndexes(references, items)).toEqual({ red: [1], blue: [1] });
  });

  it("keeps sending every image when the plan does not tell the images apart", () => {
    const together = [
      { id: "a", prompt: "以参考图1-3中的商品为准，放在卧室" },
      { id: "b", prompt: "参考图1、参考图2、参考图3的商品放在客厅" },
    ];
    expect(unmarkedIndexes(references, together)).toBe(undefined);
    expect(unmarkedIndexes(references, [{ id: "a", prompt: "生成白底主图" }])).toBe(undefined);
  });

  it("gives an item that names no picture every image, so it never loses its references", () => {
    const items = [
      { id: "first", prompt: "参考图1改为竖版" },
      { id: "second", prompt: "参考图2改为竖版" },
      { id: "mood", prompt: "整体氛围图" },
    ];
    expect(unmarkedIndexes(references, items)).toEqual({
      first: [0],
      second: [1],
      mood: [0, 1, 2],
    });
  });

  it("does not send a picture whose item was deleted to the remaining items", () => {
    const items = [1, 2, 3].map((number) => ({
      id: `plan-${number}`,
      prompt: `参考图${number}改为竖版`,
    }));
    expect(unmarkedIndexes(five, items)).toEqual({ "plan-1": [0], "plan-2": [1], "plan-3": [2] });
  });

  it("keeps marked product and style images shared and leaves explicit sources to the user", () => {
    const items = [
      { id: "b", prompt: "参考图1的风格，参考图2改为竖版" },
      { id: "c", prompt: "参考图1的风格，参考图3改为竖版" },
    ];
    const styled = planUsage(
      references,
      { product: "style" },
      items.map((item) => item.prompt),
    );
    expect(styled.inferred).toBe(true);
    expect(itemReferenceIndexes(items, references, styled, {})).toEqual({ b: [0, 1], c: [0, 2] });
    const explicit = planUsage(
      references,
      { first: "source" },
      items.map((item) => item.prompt),
    );
    expect(explicit).toEqual({ roles: { first: "source" }, inferred: false });
  });

  it("submits roles only when the user marked a style, describing inferred pictures as sources", () => {
    const prompts = ["参考图1的风格，参考图2改为红色", "参考图1的风格，参考图3改为红色"];
    useReferenceRoles.setState({ roles: {} });
    expect(planSubmissionRoles(references, planUsage(references, {}, prompts))).toBe(undefined);
    useReferenceRoles.setState({ roles: { product: "style" } });
    const styled = planUsage(references, { product: "style" }, prompts);
    expect(planSubmissionRoles(references, styled)).toEqual(["style", "source", "source"]);
  });

  it("shows inferred pictures as per-item choices on the plan card", () => {
    const prompts = ["参考图1改为竖版", "参考图2改为竖版"];
    const usage = planUsage(references, {}, prompts);
    const card = planImages(references, usage, "参考图2改为竖版", undefined);
    expect(card.shared).toEqual([]);
    expect(card.sources).toEqual([1, 2, 3]);
    expect([...card.bound]).toEqual([2]);
  });
});
