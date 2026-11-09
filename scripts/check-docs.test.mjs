import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { checkDocument, documentLinks, headingIds } from "./check-docs.mjs";

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

it("ignores code examples and extracts references, images and encoded paths", () => {
  expect(
    documentLinks(
      "`[例](missing.md)`\n```md\n[例](missing.md)\n```\n![图](image.png)\n[文](<a b.md>)\n[ref]: a%20b.md",
    ),
  ).toEqual(["image.png", "a b.md", "a%20b.md"]);
});
it("generates Chinese, inline-code and duplicate heading anchors", () => {
  expect([...headingIds("# 中文 `API`\n## 中文 API\n## 中文 API-1\n```\n# 忽略\n```")]).toEqual([
    "中文-api",
    "中文-api-1",
    "中文-api-1-1",
  ]);
});
it("rejects broken files and headings without fetching remote URLs", () => {
  const root = mkdtempSync(path.join(tmpdir(), "lycobo-docs-"));
  roots.push(root);
  writeFileSync(path.join(root, "entry.md"), "# 入口\n");
  writeFileSync(path.join(root, "a b.md"), "# 中文\n");
  const problems = checkDocument(
    root,
    "entry.md",
    "[有效](a%20b.md#中文) [自身](#入口) [外部](https://example.invalid) [文件](missing.md) [章节](a%20b.md#不存在) [越界](../private.md) [编码](%ZZ)",
  );
  expect(problems.map((p) => p.code)).toEqual([
    "MISSING_LINK_TARGET",
    "MISSING_HEADING",
    "LINK_OUTSIDE_REPOSITORY",
    "INVALID_LINK_ENCODING",
  ]);
});
