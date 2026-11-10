import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** 限定浏览器测试范围；全量运行必须显式传入 --full，避免小改动误跑全仓。 */
export function browserTestArguments(input, root = process.cwd()) {
  const args = input[0] === "--" ? input.slice(1) : [...input];
  const full = args.includes("--full");
  const forwarded = args.filter((arg) => arg !== "--full");
  if (full || forwarded.includes("--list")) return forwarded;
  const selectedFile = forwarded.some((arg) => {
    const relative = path.relative(root, path.resolve(root, arg)).split(path.sep).join("/");
    return (
      /^tests\/e2e\/.+\.spec\.[cm]?[jt]sx?$/.test(relative) && existsSync(path.resolve(root, arg))
    );
  });
  const selectedName = forwarded.some((arg, index) => {
    if (arg.startsWith("--grep=")) return arg.slice(7).trim().length > 0;
    return (
      ["--grep", "-g"].includes(arg) &&
      !!forwarded[index + 1]?.trim() &&
      !forwarded[index + 1].startsWith("-")
    );
  });
  if (!selectedFile && !selectedName)
    throw new Error(
      "请指定 tests/e2e/*.spec.ts 文件或非空 --grep。全量回归请显式运行 pnpm test:e2e:full；纯样式和文案改动无需 E2E。",
    );
  return forwarded;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = browserTestArguments(process.argv.slice(2));
    const result = spawnSync("pnpm", ["exec", "playwright", "test", ...args], { stdio: "inherit" });
    process.exitCode = result.status ?? 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "浏览器测试启动失败。");
    process.exitCode = 1;
  }
}
