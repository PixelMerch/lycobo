import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** 移除示例代码，避免把示例中的路径当成文档引用。 */
export function proseOnly(text) {
  let fence = "";
  return text
    .split("\n")
    .map((line) => {
      const marker = line.match(/^\s*(`{3,}|~{3,})/);
      if (marker && !fence) {
        fence = marker[1];
        return "";
      }
      if (fence) {
        if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = "";
        return "";
      }
      return line;
    })
    .join("\n");
}

/** 按仓库 Markdown 标题生成章节标识，重复标题保留递增后缀。 */
export function headingIds(text) {
  const used = new Set();
  for (const match of proseOnly(text).matchAll(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const base = match[1]
      .replace(/<[^>]*>/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}_\-\s]/gu, "")
      .replace(/\s/g, "-");
    let id = base;
    let suffix = 0;
    while (used.has(id)) id = `${base}-${++suffix}`;
    used.add(id);
  }
  for (const match of text.matchAll(/\b(?:id|name)=["']([^"']+)["']/g)) used.add(match[1]);
  return used;
}

/** 提取内联和引用式链接；外部 URL 由调用方跳过，不进行联网探测。 */
export function documentLinks(text) {
  const prose = proseOnly(text).replace(/(`+)[\s\S]*?\1/g, "");
  const links = [];
  for (const match of prose.matchAll(
    /\[[^\]\n]*\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+["'][^\n]*?["'])?\s*\)/g,
  ))
    links.push(match[1].replace(/^<|>$/g, ""));
  for (const match of prose.matchAll(/^ {0,3}\[[^\]]+\]:\s*(<[^>]+>|\S+)/gm))
    links.push(match[1].replace(/^<|>$/g, ""));
  return links;
}

/** 检查本地文件与章节，限定仓库范围以避免读取外部文件。 */
export function checkDocument(root, file, text) {
  const problems = [];
  for (const link of documentLinks(text)) {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(link)) continue;
    let decoded;
    try {
      decoded = decodeURIComponent(link);
    } catch {
      problems.push({ file, link, code: "INVALID_LINK_ENCODING" });
      continue;
    }
    const [pathname, anchor] = decoded.split("#", 2);
    const target = path.resolve(root, path.dirname(file), pathname || path.basename(file));
    const relative = path.relative(root, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      problems.push({ file, link, code: "LINK_OUTSIDE_REPOSITORY" });
      continue;
    }
    if (!existsSync(target)) {
      problems.push({ file, link, code: "MISSING_LINK_TARGET" });
      continue;
    }
    if (
      anchor &&
      target.endsWith(".md") &&
      statSync(target).isFile() &&
      !headingIds(readFileSync(target, "utf8")).has(anchor)
    )
      problems.push({ file, link, code: "MISSING_HEADING" });
  }
  return problems;
}

/** 检查自有说明文档，排除第三方技能快照并包含本地新增文档。 */
export function checkDocs(root) {
  const files = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8" },
  )
    .split("\0")
    .filter((file) => file.endsWith(".md") && !file.startsWith(".agents/skills/"));
  return [...new Set(files)]
    .filter((file) => existsSync(path.join(root, file)))
    .flatMap((file) => checkDocument(root, file, readFileSync(path.join(root, file), "utf8")));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = checkDocs(process.cwd());
  for (const problem of problems) console.error(`${problem.file}: ${problem.code} ${problem.link}`);
  if (problems.length) process.exitCode = 1;
  else console.info("文档本地链接与章节检查通过。");
}
