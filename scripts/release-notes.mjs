import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const versionPattern = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export function validateVersion(version) {
  if (typeof version !== "string" || version.trim() !== version || !versionPattern.test(version))
    throw new Error("版本必须采用 vX.Y.Z 格式");
  return version;
}
const groups = {
  feat: "新增功能",
  fix: "问题修复",
  perf: "性能优化",
  refactor: "代码重构",
  docs: "文档更新",
  ci: "自动化与发布",
  test: "测试",
  other: "其他改动",
};
const escapeMarkdown = (text) =>
  String(text)
    .replace(/[\r\n]/g, " ")
    .replace(/[<>&\\`*_[\]#@|]/g, (c) => `&#${c.charCodeAt(0)};`);
function git(cwd, ...args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }).trimEnd();
}
export function collectChanges(cwd, version, ref = "HEAD") {
  validateVersion(version);
  const sha = git(cwd, "rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`);
  const previous =
    git(cwd, "tag", "--merged", sha, "--sort=-version:refname")
      .split("\n")
      .find((tag) => versionPattern.test(tag) && tag !== version) ?? null;
  const range = previous ? `${previous}..${sha}` : sha;
  const commits = git(cwd, "log", "--format=%H", range)
    .split("\n")
    .filter(Boolean)
    .map((id) => {
      const [author, committer, subject] = git(
        cwd,
        "show",
        "-s",
        "--format=%an%x00%cn%x00%s",
        id,
      ).split("\0");
      const files = git(cwd, "show", "--format=", "--first-parent", "--name-only", "-z", id)
        .split("\0")
        .filter(Boolean);
      const type = subject.match(/^(\w+)(?:\([^)]*\))?!?:/u)?.[1] ?? "other";
      return {
        sha: id,
        author,
        committer,
        subject,
        type: Object.hasOwn(groups, type) ? type : "other",
        files,
      };
    });
  if (!commits.length) throw new Error("没有可发布的新提交");
  return { version, sha, previous, commits };
}
export async function loadGitHubAuthors(repository, sha, token, fetcher = fetch) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error("Invalid repository");
  const authors = new Map();
  for (let page = 1; ; page++) {
    const response = await fetcher(
      `https://api.github.com/repos/${repository}/commits?sha=${sha}&per_page=100&page=${page}`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!response.ok) throw new Error(`GitHub contributor lookup failed (${response.status})`);
    const items = await response.json();
    if (!Array.isArray(items)) throw new Error("Invalid GitHub commits response");
    for (const item of items) {
      if (typeof item.sha !== "string") throw new Error("Invalid GitHub commit");
      authors.set(item.sha, { author: item.author?.login, committer: item.committer?.login });
    }
    if (items.length < 100) break;
    if (page >= 100) throw new Error("History exceeds release pagination limit");
  }
  return authors;
}
export function renderNotes(data, repository, authors = new Map(), limit = Infinity) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error("Invalid repository");
  const url = `https://github.com/${repository}`;
  const person = (login, name) =>
    login && /^[\w-]+(?:\[bot\])?$/.test(login)
      ? `[@${login}](https://github.com/${encodeURIComponent(login)})`
      : escapeMarkdown(name);
  const contributor = (commit) => person(authors.get(commit.sha)?.author, commit.author);
  const contributors = [...new Set(data.commits.map(contributor))];
  const visible = data.commits.slice(0, limit);
  const lines = [
    `# ${data.version}`,
    "",
    "## 版本概览",
    "",
    `${data.previous ? `自 ${data.previous} 以来` : "首个版本，包含完整仓库历史"}共 ${data.commits.length} 个提交，${contributors.length} 位贡献者。`,
    `目标提交：[${data.sha.slice(0, 7)}](${url}/commit/${data.sha})。`,
    "",
  ];
  if (visible.length < data.commits.length)
    lines.push(
      `本页展示最近 ${visible.length} 个提交；完整日志及逐提交文件清单见附件 CHANGELOG.md 和 changes.json。`,
      "",
    );
  for (const [type, title] of Object.entries(groups)) {
    const items = visible.filter((commit) => commit.type === type);
    if (!items.length) continue;
    lines.push(`## ${title}`, "");
    for (const commit of items) {
      const committer = person(authors.get(commit.sha)?.committer, commit.committer);
      lines.push(
        `- ${escapeMarkdown(commit.subject)} ([${commit.sha.slice(0, 7)}](${url}/commit/${commit.sha})) · 作者 ${contributor(commit)}${committer !== contributor(commit) ? ` · 提交人 ${committer}` : ""}`,
      );
      if (commit.files.length)
        lines.push(
          `  - 涉及 ${commit.files.length} 个文件：${commit.files
            .slice(0, 6)
            .map((file) => `\`${file.replaceAll("`", "′").replace(/[\r\n]/g, " ")}\``)
            .join("、")}${commit.files.length > 6 ? "；其余见提交链接及 changes.json" : ""}`,
        );
    }
    lines.push("");
  }
  lines.push(
    "## 贡献者",
    "",
    contributors.join("、"),
    "",
    "## 完整改动",
    "",
    data.previous
      ? `[查看 ${data.previous} → ${data.version} 的全部改动](${url}/compare/${data.previous}...${data.version})`
      : `[查看首版全部提交](${url}/commits/${data.version})`,
    "",
    "本日志由 Git 提交历史自动生成；功能接入状态及迁移要求以项目文档为准。",
    "",
  );
  return lines.join("\n");
}
async function main() {
  const { values } = parseArgs({
    options: {
      version: { type: "string" },
      sha: { type: "string", default: "HEAD" },
      output: { type: "string" },
      offline: { type: "boolean", default: false },
    },
  });
  const version = validateVersion(values.version ?? process.env.RELEASE_VERSION ?? "");
  const cwd = process.cwd();
  const data = collectChanges(cwd, version, values.sha);
  const repository = process.env.GITHUB_REPOSITORY ?? "PixelMerch/lycobo";
  const token = process.env.GH_TOKEN;
  if (!values.offline && !token)
    throw new Error("GH_TOKEN is required; local preview can use --offline");
  const authors = values.offline ? new Map() : await loadGitHubAuthors(repository, data.sha, token);
  const output = path.resolve(values.output ?? "release-output");
  await mkdir(output, { recursive: true });
  const full = renderNotes(data, repository, authors);
  let limit = Math.min(150, data.commits.length);
  let summary = renderNotes(data, repository, authors, limit);
  while (summary.length > 60000 && limit > 1) {
    limit = Math.floor(limit / 2);
    summary = renderNotes(data, repository, authors, limit);
  }
  if (summary.length > 60000) throw new Error("Release summary exceeds safe length");
  await writeFile(path.join(output, "notes.md"), summary);
  await writeFile(path.join(output, "CHANGELOG.md"), full);
  await writeFile(
    path.join(output, "changes.json"),
    JSON.stringify(
      {
        ...data,
        commits: data.commits.map((commit) => ({
          ...commit,
          github: authors.get(commit.sha) ?? null,
        })),
      },
      null,
      2,
    ),
  );
  console.log(`Generated ${version}: ${data.commits.length} commits`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main();
