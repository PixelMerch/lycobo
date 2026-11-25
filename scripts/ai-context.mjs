import { execFileSync } from "node:child_process";

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 1024 * 1024 }).trim();
}

/** 输出接手所需的 Git 元数据，不读取文件内容、环境配置或网络凭据。 */
function printContext() {
  console.info(`仓库：${git("rev-parse", "--show-toplevel")}`);
  console.info(`HEAD：${git("rev-parse", "HEAD")}`);
  const status = git("status", "--short", "--branch", "--untracked-files=normal").split("\n");
  console.info(status.slice(0, 31).join("\n"));
  if (status.length > 31)
    console.info(`另有 ${status.length - 31} 行状态，请按任务范围查看 git status。`);
  console.info(`最近提交：\n${git("log", "-3", "--format=%h %s")}`);
  console.info(
    "远端比较基于本地跟踪引用，本命令不 fetch。验证结果、文件归属及操作授权需据实填写交接记录。",
  );
  console.info("阅读入口：AGENTS.md → docs/README.md");
}

printContext();
