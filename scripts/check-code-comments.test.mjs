import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { findCommentProblems, parseChangedLines } from "./check-code-comments.mjs";

const sourcePath = "apps/api/src/example.ts";
const messages = (file, text, changedLines) =>
  findCommentProblems(file, text, new Set(changedLines)).map(
    ({ line, message }) => `${line}: ${message}`,
  );

describe("findCommentProblems", () => {
  it("rejects an English comment on a changed line", () => {
    expect(messages(sourcePath, "// Keep the retry bounded.\nconst retries = 3;\n", [1])).toEqual([
      "1: 注释要写中文",
    ]);
  });

  it("leaves unchanged code alone", () => {
    const text = "// Old comment.\nexport function oldCode() {}\n\nconst changed = 1;\n";
    expect(messages(sourcePath, text, [4])).toEqual([]);
  });

  it("requires comments inside a changed declaration to be Chinese", () => {
    const text = "function run() {\n  // Old reason.\n  return 1;\n}\n";
    expect(messages(sourcePath, text, [3])).toEqual(["2: 注释要写中文"]);
  });

  it("accepts Chinese comments that mention English identifiers", () => {
    const text = "function run() {\n  // 失败时保留 outbox，等待 Cron 重试。\n  return 1;\n}\n";
    expect(messages(sourcePath, text, [2, 3])).toEqual([]);
  });

  it.each([
    ["function", "export function run() {\n  return 1;\n}\n", "run"],
    ["async function", "export async function run() {\n  return 1;\n}\n", "run"],
    ["default function", "export default function () {\n  return 1;\n}\n", "default"],
    ["class", "export class Runner {\n  run() {}\n}\n", "Runner"],
    ["arrow function", "export const run = () => {\n  return 1;\n};\n", "run"],
  ])("requires a Chinese purpose comment on a changed exported %s", (_, text, name) => {
    expect(messages(sourcePath, text, [2])).toEqual([`1: 导出的 ${name} 缺少中文用途注释`]);
    expect(messages(sourcePath, `/** 运行任务。 */\n${text}`, [3])).toEqual([]);
  });

  it("rejects an English purpose comment on a changed export", () => {
    const text = "/** Runs the task. */\nexport function run() {\n  return 1;\n}\n";
    expect(messages(sourcePath, text, [3])).toEqual([
      "1: 注释要写中文",
      "2: 导出的 run 缺少中文用途注释",
    ]);
  });

  it("does not treat a comment separated by a blank line as the purpose comment", () => {
    const text = "// 文件说明。\n\nexport function run() {}\n";
    expect(messages(sourcePath, text, [3])).toEqual(["3: 导出的 run 缺少中文用途注释"]);
  });

  it("does not require comments on exported data and types", () => {
    const text = "export const limit = 3;\nexport type Limit = number;\n";
    expect(messages(sourcePath, text, [1, 2])).toEqual([]);
  });

  it("only asks for one comment on overloaded exports", () => {
    const text = [
      "export function run(value: string): string;",
      "export function run(value: number): number;",
      "/** 运行任务。 */",
      "export function run(value: unknown) {",
      "  return value;",
      "}",
      "",
    ].join("\n");
    expect(messages(sourcePath, text, [1, 2, 3, 4, 5, 6])).toEqual([]);
  });

  it("keeps tool directives untranslated", () => {
    const text = [
      "/** 运行任务。 */",
      "// biome-ignore lint/suspicious/noExplicitAny: third-party callback",
      "export function run() {}",
      "// @ts-expect-error old typing",
      "run(1);",
      "",
    ].join("\n");
    expect(messages(sourcePath, text, [1, 2, 3, 4, 5])).toEqual([]);
  });

  it("treats a wrapped sentence as one comment", () => {
    const text = "// 这里要等待旧任务结束，\n// retryAfter\nconst value = 1;\n";
    expect(messages(sourcePath, text, [1, 2, 3])).toEqual([]);
  });

  it("limits comments to three lines", () => {
    const text = "// 一\n// 二\n// 三\n// 四\nconst value = 1;\n";
    expect(messages(sourcePath, text, [1])).toEqual(["1: 注释最多 3 行，当前 4 行"]);
    const block = "/**\n * 一\n * 二\n * 三\n */\nconst value = 1;\n";
    expect(messages(sourcePath, block, [1])).toEqual([]);
  });

  it("keeps comments at the end of neighbouring code lines separate", () => {
    const text = [
      "const config = {",
      "  rows: 8, // 行数",
      "  columns: 4, // 列数",
      "  gap: 2, // 间距",
      "  size: 1, // 尺寸",
      "};",
      "",
    ].join("\n");
    expect(messages(sourcePath, text, [2, 3, 4, 5])).toEqual([]);
  });

  it("does not use a comment at the end of the previous line as the purpose comment", () => {
    const text = "const value = 1; // 默认值\nexport function run() {}\n";
    expect(messages(sourcePath, text, [2])).toEqual(["2: 导出的 run 缺少中文用途注释"]);
  });

  it("ignores comment markers inside strings and regular expressions", () => {
    const text = [
      'const url = "https://example.com // English";',
      `const template = \`// English \${url} // more\`;`,
      "const pattern = /\\/\\/ English/;",
      "",
    ].join("\n");
    expect(messages(sourcePath, text, [1, 2, 3])).toEqual([]);
  });

  it("finds comments in JSX and at the end of a block", () => {
    const text = [
      "const view = (",
      "  <div>",
      "    {/* Old layout */}",
      "    https://example.com",
      "  </div>",
      ");",
      "function run() {",
      "  // End of block.",
      "}",
      "",
    ].join("\n");
    expect(messages("apps/web/src/view.tsx", text, [3, 8])).toEqual([
      "3: 注释要写中文",
      "8: 注释要写中文",
    ]);
  });

  it("allows comments without letters", () => {
    expect(messages(sourcePath, "// ---\nconst value = 1;\n", [1])).toEqual([]);
  });

  it("only checks the changed comment lines of a test file", () => {
    const text = [
      'describe("run", () => {',
      "  // Old note.",
      '  it("works", () => {',
      "    // New note.",
      "  });",
      "});",
      "export function helper() {}",
      "",
    ].join("\n");
    expect(messages("apps/api/src/example.test.ts", text, [4, 7])).toEqual(["4: 注释要写中文"]);
  });
});

describe("parseChangedLines", () => {
  it("collects added and replaced lines for each file", () => {
    const diff = [
      "diff --git a/one.ts b/one.ts",
      "--- a/one.ts",
      "+++ b/one.ts",
      "@@ -1 +1 @@",
      "-old",
      "+new",
      "@@ -9,0 +10,2 @@ function run() {",
      "+first",
      "+second",
      "diff --git a/old-name.ts b/new-name.ts",
      "similarity index 90%",
      "rename from old-name.ts",
      "rename to new-name.ts",
      "@@ -4,2 +4,1 @@",
      "-a",
      "-b",
      "+c",
      "",
    ].join("\n");
    expect(parseChangedLines(diff)).toEqual(
      new Map([
        ["one.ts", new Set([1, 10, 11])],
        ["new-name.ts", new Set([4])],
      ]),
    );
  });

  it("does not count deleted lines", () => {
    const diff = "diff --git a/one.ts b/one.ts\n@@ -3,2 +2,0 @@\n-a\n-b\n";
    expect(parseChangedLines(diff)).toEqual(new Map([["one.ts", new Set()]]));
  });

  it("does not mistake changed code for a diff header", () => {
    const diff = "diff --git a/one.ts b/one.ts\n@@ -0,0 +1 @@\n+diff --git a/two.ts b/two.ts\n";
    expect([...parseChangedLines(diff).keys()]).toEqual(["one.ts"]);
  });
});

describe("command line check", () => {
  const scriptPath = fileURLToPath(new URL("./check-code-comments.mjs", import.meta.url));
  const repositories = [];

  afterEach(() => {
    for (const repository of repositories.splice(0)) {
      rmSync(repository, { recursive: true, force: true });
    }
  });

  function createRepository() {
    // macOS 的临时目录是符号链接，要用真实路径才能和子进程的 cwd 对上。
    const cwd = realpathSync(mkdtempSync(path.join(tmpdir(), "lycobo-comments-test-")));
    repositories.push(cwd);
    const git = (...args) =>
      execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", ...args], {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    const write = (file, text) => {
      mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
      writeFileSync(path.join(cwd, file), text);
    };
    git("init", "--initial-branch=main");
    write(
      "apps/api/src/old.ts",
      "// Old note.\nexport function oldCode() {}\n\nconst other = 1;\n",
    );
    git("add", ".");
    git("commit", "--no-verify", "-m", "initial");
    return { cwd, git, write };
  }

  const run = (cwd, ...args) =>
    spawnSync(process.execPath, [scriptPath, ...args], { cwd, encoding: "utf8" });

  it("passes when only old code exists", () => {
    const { cwd, git } = createRepository();
    const result = run(cwd, `--base=${git("rev-parse", "HEAD")}`);
    expect(result.status).toBe(0);
  });

  it("reports committed, uncommitted and untracked changes after the start commit", () => {
    const { cwd, git, write } = createRepository();
    const startCommit = git("rev-parse", "HEAD");
    write("apps/api/src/committed.ts", "// Committed note.\nconst value = 1;\n");
    git("add", ".");
    git("commit", "--no-verify", "-m", "next");
    write(
      "apps/api/src/old.ts",
      "// Old note.\nexport function oldCode() {}\n\n// New note.\nconst other = 2;\n",
    );
    write("apps/api/src/untracked.ts", "export function added() {}\n");
    const result = run(cwd, `--base=${startCommit}`);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("apps/api/src/committed.ts:1: 注释要写中文");
    expect(result.stderr).toContain("apps/api/src/old.ts:4: 注释要写中文");
    expect(result.stderr).toContain("apps/api/src/untracked.ts:1: 导出的 added 缺少中文用途注释");
    expect(result.stderr).not.toContain("apps/api/src/old.ts:1");
  });

  it("only checks the files passed by the commit hook", () => {
    const { cwd, git, write } = createRepository();
    const startCommit = git("rev-parse", "HEAD");
    write("apps/api/src/first.ts", "// First note.\nconst first = 1;\n");
    write("apps/api/src/second.ts", "// Second note.\nconst second = 1;\n");
    const result = run(cwd, `--base=${startCommit}`, path.join(cwd, "apps/api/src/first.ts"));
    expect(result.stderr).toContain("first.ts:1");
    expect(result.stderr).not.toContain("second.ts");
  });

  it("does not check files outside the source directories", () => {
    const { cwd, git, write } = createRepository();
    const startCommit = git("rev-parse", "HEAD");
    write("docs/example.ts", "// Sample note.\nconst value = 1;\n");
    expect(run(cwd, `--base=${startCommit}`).status).toBe(0);
  });

  it("fails when the start commit is missing from the history", () => {
    const { cwd } = createRepository();
    const result = run(cwd, `--base=${"0".repeat(40)}`);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("需要完整的 git 历史");
  });
});
