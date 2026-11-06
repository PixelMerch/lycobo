import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { z } from "zod";
import { supabaseMigrationTarget } from "./supabase-target.mjs";

/** 仅在正式部署成功后发布摘要；版本号幂等，不把构建失败当作上线。 */
async function publish() {
  if (!process.argv.includes("--production")) throw new Error("必须显式选择 --production");
  const target = supabaseMigrationTarget(process.env);
  // 限制到当前 Lycobo Cloudflare 使用的数据库，避免误操作旧环境。
  if (process.env.SUPABASE_PROJECT_REF !== "uyfgzmqijdsesnlsiwqu")
    throw new Error("数据库项目不匹配");
  const release = z
    .object({
      version: z.string().min(1).max(80),
      title: z.string().min(1).max(120),
      description: z.string().min(1).max(2000),
    })
    .parse(JSON.parse(await readFile(new URL("../../../release.json", import.meta.url), "utf8")));
  const payload = { ...release, publishedAt: new Date().toISOString() };
  const sql = postgres(target.url, { max: 1, connect_timeout: 10, prepare: false });
  try {
    const inserted = await sql.begin(async (tx) => {
      const rows = await tx`insert into realtime_releases(version,payload,published_at)
        values (${release.version},${tx.json(payload)},${payload.publishedAt}) on conflict do nothing returning version`;
      if (!rows.length) return false;
      await tx`insert into realtime_outbox(channel,event)
        select channel,jsonb_build_object('id',gen_random_uuid(),'kind','release','release',${tx.json(payload)}::jsonb)
        from (select id::text as channel from organizations union all select 'public') channels`;
      await tx`insert into realtime_notifications(organization_id,title,body)
        select id,${release.title},${release.description} from organizations`;
      return true;
    });
    console.info({ version: release.version, published: inserted });
  } finally {
    await sql.end({ timeout: 5 });
  }
}
try {
  await publish();
} catch {
  console.error("发布摘要失败，请检查目标数据库、迁移和版本；未输出连接凭证。");
  process.exitCode = 1;
}
