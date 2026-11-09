import { describe, expect, it } from "vitest";
import { inspectUiText } from "./check-ui-text.mjs";

const lines = (text, file = "apps/web/src/features/example.tsx") =>
  inspectUiText(text, file).map(({ line, message }) => `${line}: ${message}`);

describe("inspectUiText", () => {
  it("rejects Chinese interface text outside message catalogs", () => {
    expect(lines("export const Title = () => <h1>素材库</h1>;\n")).toEqual([
      "1: 界面文字要写进 *-messages.ts 文案目录，并同时提供英文：素材库",
    ]);
    const sample = `const label = "删除";\nconst note = \`共 \${count} 张\`;\n`;
    expect(lines(sample)).toHaveLength(2);
  });

  it("ignores comments and the @图片N prompt token", () => {
    const text = `// 中文注释没问题\nconst token = \`@图片\${index + 1}\`;\nconst pattern = /@图片\\d+/;\n`;
    expect(lines(text)).toEqual([]);
  });

  it("allows Chinese in catalogs but not in their English entries", () => {
    const catalog = `import { defineMessages } from "../i18n/messages";
export const demo = defineMessages({
  "zh-CN": { title: "素材库", count: (n: number) => \`共 \${n} 张\` },
  en: { title: "资产库", count: (n) => \`\${n} images\` },
});
`;
    expect(lines(catalog, "apps/web/src/features/demo-messages.ts")).toEqual([
      "4: 英文文案里有中文：资产库",
    ]);
  });
});
