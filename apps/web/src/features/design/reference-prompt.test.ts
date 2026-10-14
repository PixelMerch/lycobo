import { describe, expect, it } from "vitest";
import type { ReferenceImage } from "./design-data";
import {
  formatReferencePrompt,
  insertReferenceSpace,
  parseReferencePrompt,
} from "./reference-prompt";

const references: ReferenceImage[] = [
  { id: "first", number: 1, name: "商品一", shot: 0 },
  { id: "second", number: 2, name: "商品二", shot: 1 },
];

describe("reference prompt", () => {
  it("inserts a space and moves the caret forward without losing following description", () => {
    expect(insertReferenceSpace("前面@后面", 2, 3)).toEqual({
      description: "前面 后面",
      caret: 3,
    });
    expect(insertReferenceSpace("", 0, 0)).toEqual({ description: " ", caret: 1 });
  });
  it("deduplicates pasted references and keeps their first selection order", () => {
    const parsed = parseReferencePrompt("@图片2 @图片1 @图片2 保留商品细节", references);
    expect(parsed.selected.map((image) => image.id)).toEqual(["second", "first"]);
    expect(parsed.description).toBe("保留商品细节");
    expect(formatReferencePrompt(parsed.selected, parsed.description)).toBe(
      "@图片2 @图片1 保留商品细节",
    );
  });

  it("keeps missing references and ordinary multiline text editable", () => {
    const description = "保留 @图片12 与包装\n  暖色光影";
    const parsed = parseReferencePrompt(`@图片1 ${description}`, references);
    expect(parsed.selected).toEqual([references[0]]);
    expect(parsed.description).toBe(description);
  });

  it("can remove a tag without changing the remaining description or source images", () => {
    const parsed = parseReferencePrompt("@图片1 @图片2 保留细节", references);
    const remaining = parsed.selected.filter((image) => image.id !== "first");
    expect(formatReferencePrompt(remaining, parsed.description)).toBe("@图片2 保留细节");
    expect(formatReferencePrompt([], parsed.description)).toBe("保留细节");
    expect(references).toHaveLength(2);
  });
});
