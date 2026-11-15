import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

if (process.env.GITHUB_ACTIONS !== "true") {
  throw new Error("浏览器端到端测试仅在 GitHub Actions 中运行。");
}

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  workers: 1,
  forbidOnly: true,
  retries: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  // 用例按中文界面编写，固定浏览器语言为简体中文；英文界面由 language.spec.ts 单独覆盖。
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure", locale: "zh-CN" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node scripts/local/dev.mjs --api-only",
      cwd: repoRoot,
      url: "http://127.0.0.1:8787/api/health/live",
      // 让本地入口先清理独立子进程，避免强杀入口后遗留进程阻塞测试退出。
      gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
    },
    {
      command: "pnpm --filter @lycoboai/web dev",
      cwd: repoRoot,
      url: "http://127.0.0.1:5173",
      gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
    },
  ],
});
