import { describe, expect, it } from "vitest";
import { hasPromptDescription } from "./prompt-description";

describe("generation description", () => {
  it.each(["", "  \n", "@", "@ @", "@图片1 @图片2", "@图片1\u200b", "@，。…"])(
    "rejects reference-only input %s",
    (prompt) => {
      expect(hasPromptDescription(prompt)).toBe(false);
    },
  );
  it.each(["保留主体，换成红色", "@图片1 保留主体", "A white product on a table", "1254 像素"])(
    "accepts a description %s",
    (prompt) => {
      expect(hasPromptDescription(prompt)).toBe(true);
    },
  );
});
