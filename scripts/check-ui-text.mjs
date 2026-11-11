import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// 界面同时提供简体中文与英文：中文文字只能写在 *-messages.ts 文案目录里，目录的英文版不能混入中文。
const han = /\p{Script=Han}/u;
// 提示词里引用第 N 张参考图的写法“@图片N”是与服务端共用的约定，不算界面文字。
const promptToken = /@图片/g;
// 不随界面语言变化的固定中文，各自说明原因；新增前需要说明为什么它不是界面文字。
export const allowedFiles = new Map([
  ["apps/web/src/i18n/locale.ts", "语言菜单用各语言自己的名称书写（简体中文、中文）"],
  [
    "apps/web/src/features/image-workspace/local-edit/local-repair-state.ts",
    "局部修改时交给模型的固定说明，属于模型输入",
  ],
  ["apps/web/src/features/generation/prompt-display.ts", "家纺裂变任务固定提交的提示词标记"],
  ["apps/web/src/features/realtime/completion-storage.ts", "跨标签完成回执里校验用的固定标记"],
]);

const isCatalog = (file) => file.endsWith("-messages.ts");

function textOf(node, source) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node))
    return node.text;
  if (ts.isTemplateExpression(node)) return node.getText(source);
  return null;
}

function hasHan(text) {
  return han.test(text.replace(promptToken, ""));
}

// 找出文案目录里 en 版本的对象：defineMessages({ "zh-CN": ..., en: ... }) 的 en 属性。
function englishEntries(source) {
  const found = [];
  const visit = (node) => {
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "en" &&
      ts.isObjectLiteralExpression(node.initializer)
    )
      found.push(node.initializer);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function collectHan(root, source, report) {
  const visit = (node) => {
    const text = textOf(node, source);
    if (text !== null && hasHan(text)) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
      report(line + 1, text.trim().replace(/\s+/g, " ").slice(0, 60));
      if (ts.isTemplateExpression(node)) return;
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
}

/** 检查一个源文件：普通源码不能写中文字面量，文案目录的英文版不能出现中文。 */
export function inspectUiText(text, file) {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const problems = [];
  if (isCatalog(file)) {
    for (const entries of englishEntries(source))
      collectHan(entries, source, (line, sample) =>
        problems.push({ line, message: `英文文案里有中文：${sample}` }),
      );
    return problems;
  }
  collectHan(source, source, (line, sample) =>
    problems.push({
      line,
      message: `界面文字要写进 *-messages.ts 文案目录，并同时提供英文：${sample}`,
    }),
  );
  return problems;
}

async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(file)));
    else if (/\.(ts|tsx)$/.test(file) && !/\.test\.|\.d\.ts$/.test(file)) files.push(file);
  }
  return files;
}

/** 检查整个前端源码目录，返回问题数。 */
export async function checkUiText(directory = "apps/web/src") {
  let errors = 0;
  for (const file of await sourceFiles(directory)) {
    const relative = path.relative(process.cwd(), file).split(path.sep).join("/");
    if (allowedFiles.has(relative)) continue;
    for (const problem of inspectUiText(await readFile(file, "utf8"), relative)) {
      console.error(`${relative}:${problem.line}: ${problem.message}`);
      errors++;
    }
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = await checkUiText();
  if (errors) {
    console.error(`共 ${errors} 处，规则见 apps/web/AGENTS.md 的界面语言说明。`);
    process.exitCode = 1;
  } else console.log("UI text catalog checks passed.");
}
