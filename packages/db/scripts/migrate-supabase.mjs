import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { secureSupabase } from "./secure-supabase.mjs";
import { supabaseMigrationTarget } from "./supabase-target.mjs";

try {
  if (process.argv.slice(2).some((arg) => arg !== "--check")) {
    throw new Error("仅支持 --check 参数。");
  }
  const target = supabaseMigrationTarget(process.env);
  console.log(`迁移目标：${target.host}/postgres；复用现有 Drizzle 迁移链。`);
  if (process.argv.includes("--check")) {
    console.log("连接配置检查通过；未连接数据库，未执行迁移。");
  } else {
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("../node_modules/drizzle-kit/bin.cjs", import.meta.url)), "migrate"],
      {
        cwd: fileURLToPath(new URL("../", import.meta.url)),
        env: { ...process.env, DATABASE_URL: target.url },
        encoding: "utf8",
        stdio: "pipe",
        maxBuffer: 8 * 1024 * 1024,
        timeout: 120_000,
      },
    );
    // Driver errors can contain connection strings. Never forward captured output.
    if (result.error || result.status !== 0) {
      console.error(
        "Supabase 结构迁移失败。请检查数据库密码、网络与现有迁移状态；连接信息未输出。",
      );
      process.exitCode = 1;
    } else {
      try {
        const count = await secureSupabase(target.url);
        console.log(
          `Supabase 迁移链执行成功，${count} 张业务表已启用 RLS 并撤销前端角色权限；未导入本地业务数据。`,
        );
      } catch {
        console.error(
          "结构迁移已执行，但业务表访问加固失败；请修复后重跑，不要开放 Data API 或切换应用。",
        );
        process.exitCode = 1;
      }
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Supabase 迁移配置无效。");
  process.exitCode = 1;
}
