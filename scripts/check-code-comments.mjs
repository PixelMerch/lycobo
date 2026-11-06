import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/**
 * 中文注释检查：只看规则起点之后新增或改过的代码，旧代码改到时才需要补齐。
 * 规则说明见 docs/node-ts-best-practices.md 的“中文注释”一节。
 */
const ruleStartCommit = "f8d4974a5ca803d6c6a2cece3302882972c47211";
const checkedFile = /^(?:apps|packages|scripts|tests)\/.*\.(?:ts|tsx|mjs)$/;
const testFile = /\.(?:test|spec)\.|^tests\//;
/** 这些注释是给工具读的指令，翻译后工具就不认识了。 */
const toolDirective = /^(?:biome-ignore|@ts-)/;
const hanCharacter = /\p{Script=Han}/u;
const latinLetter = /[A-Za-z]/;
const maxCommentLines = 3;

function parse(file, text) {
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
}

function lineOf(source, position) {
  return source.getLineAndCharacterOfPosition(position).line + 1;
}

/** 用语法树找注释，字符串和正则里的 `//` 不会被当成注释。 */
function readCommentRanges(source) {
  const ranges = new Map();
  const remember = (found) => {
    for (const range of found ?? []) ranges.set(range.pos, range);
  };
  const visit = (node) => {
    if (ts.isJSDoc(node) || ts.isJsxText(node)) return;
    remember(ts.getLeadingCommentRanges(source.text, node.getFullStart()));
    remember(ts.getTrailingCommentRanges(source.text, node.getEnd()));
    for (const child of node.getChildren(source)) visit(child);
  };
  visit(source);
  return [...ranges.values()].sort((left, right) => left.pos - right.pos);
}

/** 注释前面只有空白时返回 true。写在代码行尾的注释只说明那一行。 */
function startsOwnLine(source, position) {
  const { line } = source.getLineAndCharacterOfPosition(position);
  const lineStart = source.getPositionOfLineAndCharacter(line, 0);
  return source.text.slice(lineStart, position).trim() === "";
}

/** 连续独占一行的 `//` 算同一段注释，一句话换行后不会被拆开检查。 */
function groupComments(source, ranges) {
  const blocks = [];
  for (const range of ranges) {
    const ownLine = startsOwnLine(source, range.pos);
    const canJoin = ownLine && range.kind === ts.SyntaxKind.SingleLineCommentTrivia;
    const startLine = lineOf(source, range.pos);
    const endLine = lineOf(source, range.end);
    const text = source.text.slice(range.pos, range.end);
    const previous = blocks.at(-1);
    if (canJoin && previous?.canJoin && previous.endLine + 1 === startLine) {
      previous.endLine = endLine;
      previous.text += `\n${text}`;
      continue;
    }
    blocks.push({ canJoin, ownLine, startLine, endLine, text });
  }
  return blocks;
}

/** 去掉注释符号，只留下文字行。 */
function commentLines(text) {
  return text
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s*(?:\/\/+|\/\*+|\*+\/|\*+)/, "")
        .replace(/\*+\/\s*$/, "")
        .trim(),
    )
    .filter(Boolean);
}

function isToolDirective(block) {
  return toolDirective.test(commentLines(block.text)[0] ?? "");
}

/** 返回这段注释的问题，没有问题时返回 null。没有英文字母的注释不算英文。 */
function commentProblem(block) {
  if (isToolDirective(block)) return null;
  const lines = commentLines(block.text);
  const words = lines.join("\n");
  if (latinLetter.test(words) && !hanCharacter.test(words)) return "注释要写中文";
  if (lines.length > maxCommentLines) {
    return `注释最多 ${maxCommentLines} 行，当前 ${lines.length} 行`;
  }
  return null;
}

function isFunctionValue(node) {
  if (!node) return false;
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isClassExpression(node);
}

/** 返回需要用途注释的导出名称，类型、配置对象这类语句返回 null。 */
function exportedCodeName(statement) {
  const isExported = statement.modifiers?.some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
  );
  if (!isExported) return null;
  if (ts.isClassDeclaration(statement)) return statement.name?.text ?? "default";
  if (ts.isFunctionDeclaration(statement)) {
    // 没有函数体的是重载声明，注释写在真正的实现上。
    return statement.body ? (statement.name?.text ?? "default") : null;
  }
  if (!ts.isVariableStatement(statement)) return null;
  const declaration = statement.declarationList.declarations.find((item) =>
    isFunctionValue(item.initializer),
  );
  return declaration?.name.getText() ?? null;
}

/** 紧贴语句上方要有中文注释，中间隔着工具指令也算紧贴。 */
function hasChineseDoc(blocks, statementLine) {
  let nextLine = statementLine;
  for (const block of blocks.toReversed()) {
    if (block.endLine >= nextLine) continue;
    if (block.endLine + 1 !== nextLine || !block.ownLine) return false;
    if (!isToolDirective(block)) return hanCharacter.test(block.text);
    nextLine = block.startLine;
  }
  return false;
}

function touchesChangedLine(startLine, endLine, changedLines) {
  for (let line = startLine; line <= endLine; line += 1) {
    if (changedLines.has(line)) return true;
  }
  return false;
}

/** 找出改动落在哪些顶层语句里。import 没有业务逻辑，不算。 */
function findChangedStatements(source, changedLines) {
  return source.statements
    .filter((statement) => !ts.isImportDeclaration(statement))
    .map((statement) => ({
      statement,
      fullStartLine: lineOf(source, statement.getFullStart()),
      startLine: lineOf(source, statement.getStart(source)),
      endLine: lineOf(source, statement.getEnd()),
    }))
    .filter(({ startLine, endLine }) => touchesChangedLine(startLine, endLine, changedLines));
}

/** 检查一个文件。`changedLines` 是改动后的行号，只有改过的代码才需要合规。 */
export function findCommentProblems(file, text, changedLines) {
  const source = parse(file, text);
  const blocks = groupComments(source, readCommentRanges(source));
  // 测试只看改到的注释行，否则改一个用例就要翻译整个 describe。
  const statements = testFile.test(file) ? [] : findChangedStatements(source, changedLines);
  const isInChangedCode = (block) =>
    touchesChangedLine(block.startLine, block.endLine, changedLines) ||
    statements.some(
      (item) => item.fullStartLine <= block.startLine && block.endLine <= item.endLine,
    );
  const problems = [];
  for (const block of blocks.filter(isInChangedCode)) {
    const message = commentProblem(block);
    if (message) problems.push({ file, line: block.startLine, message });
  }
  for (const { statement, startLine } of statements) {
    const name = exportedCodeName(statement);
    if (name && !hasChineseDoc(blocks, startLine)) {
      problems.push({ file, line: startLine, message: `导出的 ${name} 缺少中文用途注释` });
    }
  }
  return problems.sort((left, right) => left.line - right.line);
}

/** 从 `git diff --unified=0` 的输出里取出每个文件新增或改过的行号。 */
export function parseChangedLines(diff) {
  const changed = new Map();
  let fileLines = new Set();
  for (const row of diff.split("\n")) {
    const file = row.match(/^diff --git a\/.+ b\/(.+)$/)?.[1];
    if (file) {
      fileLines = new Set();
      changed.set(file, fileLines);
      continue;
    }
    const hunk = row.match(/^@@ -\S+ \+(\d+)(?:,(\d+))? @@/);
    if (!hunk) continue;
    const firstLine = Number(hunk[1]);
    const lineCount = Number(hunk[2] ?? 1);
    for (let line = firstLine; line < firstLine + lineCount; line += 1) fileLines.add(line);
  }
  return changed;
}

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** 分支落后于规则起点时退回分叉点，不把其他分支的改动算进来。 */
function findBaseCommit(startCommit) {
  try {
    return git(["merge-base", startCommit, "HEAD"]).trim();
  } catch {
    // 查不到起点时必须失败，否则浅克隆会让检查悄悄失效。
    console.error(`找不到规则起点 ${startCommit}，需要完整的 git 历史（CI 设置 fetch-depth: 0）。`);
    process.exit(1);
  }
}

/** 读取改动过的文件，包含还没提交的改动。未跟踪的文件值为 null，表示整个文件都是新代码。 */
function readChangedFiles(startCommit) {
  const diff = git([
    "-c",
    "core.quotePath=false",
    "diff",
    "--unified=0",
    "--find-renames",
    "--no-color",
    "--no-ext-diff",
    "--src-prefix=a/",
    "--dst-prefix=b/",
    findBaseCommit(startCommit),
  ]);
  const changed = parseChangedLines(diff);
  for (const file of git(["ls-files", "--others", "--exclude-standard"]).split("\n")) {
    if (file) changed.set(file, null);
  }
  return changed;
}

function everyLine(text) {
  return new Set(text.split("\n").map((_, index) => index + 1));
}

function findProblems(startCommit, selectedFiles) {
  const problems = [];
  for (const [file, lines] of readChangedFiles(startCommit)) {
    const isSelected = selectedFiles.size === 0 || selectedFiles.has(file);
    if (!isSelected || !checkedFile.test(file) || !existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    problems.push(...findCommentProblems(file, text, lines ?? everyLine(text)));
  }
  return problems;
}

function report(problems) {
  for (const { file, line, message } of problems) console.error(`${file}:${line}: ${message}。`);
  if (problems.length === 0) {
    console.log("Chinese comment checks passed.");
    return;
  }
  console.error(`共 ${problems.length} 处，规则见 docs/node-ts-best-practices.md。`);
  process.exitCode = 1;
}

function main(args) {
  const baseOption = args.find((arg) => arg.startsWith("--base="));
  const startCommit = baseOption?.slice("--base=".length) ?? ruleStartCommit;
  // lint-staged 会传入暂存文件的路径，这时只检查这些文件。
  const selectedFiles = args
    .filter((arg) => !arg.startsWith("--"))
    .map((file) => path.relative(process.cwd(), file));
  report(findProblems(startCommit, new Set(selectedFiles)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
