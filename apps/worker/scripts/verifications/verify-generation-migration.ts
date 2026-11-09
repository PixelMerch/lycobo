import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { z } from "zod";

type TableSnapshot = { oid: unknown; rows: postgres.RowList<postgres.Row[]> };

const tables = [
  ["image_api_keys", "generation_api_keys"],
  ["image_jobs", "generation_jobs"],
  ["image_job_items", "generation_job_items"],
  ["image_credit_ledger", "generation_credit_ledger"],
  ["image_outbox", "generation_outbox"],
  ["image_events", "generation_events"],
  ["image_retries", "generation_retries"],
] as const;

/** 在图片集成检查创建的临时库中验证追加迁移与历史数据完整性。 */
export async function verifyGenerationMigration(databaseUrl: string) {
  const root = fileURLToPath(new URL("../../../../", import.meta.url).href);
  const migrations = path.join(root, "packages/db/migrations");
  const directory = await mkdtemp(path.join(tmpdir(), "lycobo-generation-migration-"));
  const sql = postgres(databaseUrl, { max: 1 });
  const migrate = (config?: string) => {
    const result = spawnSync(
      "pnpm",
      ["--filter", "@lycoboai/db", "db:migrate", ...(config ? ["--config", config] : [])],
      { cwd: root, env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe" },
    );
    assert.equal(result.status, 0, "Isolated generation migration failed");
  };
  try {
    const { config, through14, through15 } = await prepareLegacyMigrations(migrations, directory);
    migrate(config);
    const { orgId, userId, key, jobId, itemId, assetId } = await seedLegacyGeneration(sql);
    const capture = async (table: string) => {
      const [row] = await sql`select ${table}::regclass::oid::text as oid`;
      return {
        oid: row?.oid,
        rows: await sql`select a.* from ${sql(table)} a order by row_to_json(a)::text`,
      };
    };
    const before = await Promise.all(tables.map(([old]) => capture(old)));
    const linked = ["media_assets", "image_local_edits"];
    const linkedBefore = await Promise.all(linked.map(capture));
    await writeFile(path.join(directory, "meta/_journal.json"), JSON.stringify(through14));
    const rename = through14.entries.find((entry) => entry.idx === 14);
    assert.ok(rename);
    await copyFile(
      path.join(migrations, `${rename.tag}.sql`),
      path.join(directory, `${rename.tag}.sql`),
    );
    migrate(config);
    for (const [index, [old, current]] of tables.entries()) {
      assert.deepEqual(
        await capture(current),
        before[index],
        `${current} must preserve OID and rows`,
      );
      assert.deepEqual(
        await sql`select a.* from ${sql(old)} a order by row_to_json(a)::text`,
        before[index]?.rows,
      );
    }
    // 存在依赖时必须阻止收缩迁移，保留别名和原有数据。
    await verifyGenerationContraction(
      sql,
      root,
      databaseUrl,
      directory,
      through15,
      migrations,
      migrate,
      config,
      capture,
      before,
      linked,
      linkedBefore,
      orgId,
      userId,
      key,
      jobId,
      itemId,
    );
    // 先验证收缩，再验证后续追加迁移，便于定位失败阶段。
    migrate();
    assert.equal(
      (await sql`select target_item_id from generation_retries where job_id=${jobId}`)[0]
        ?.target_item_id,
      null,
    );
    await sql.begin(async (tx) => {
      await tx`delete from generation_outbox where item_id=${itemId}`;
      await tx`delete from generation_retries where organization_id=${orgId}`;
      await tx`delete from generation_credit_ledger where organization_id=${orgId}`;
      await tx`delete from image_local_edits where job_id=${jobId}`;
      await tx`delete from generation_job_items where job_id=${jobId}`;
      await tx`delete from generation_jobs where id=${jobId}`;
      await tx`delete from generation_api_keys where organization_id=${orgId}`;
      await tx`delete from generation_events where organization_id=${orgId}`;
      await tx`delete from media_assets where id=${assetId}`;
      await tx`delete from organization_members where organization_id=${orgId}`;
      await tx`delete from organizations where id=${orgId}`;
      await tx`delete from users where id=${userId}`;
    });
    console.log(
      "Generation upgrade and legacy view removal preserved data, links, idempotency and dependency protection",
    );
  } finally {
    await sql.end({ timeout: 5 });
    await rm(directory, { recursive: true, force: true });
  }
}

async function prepareLegacyMigrations(migrations: string, directory: string) {
  const journal = z
    .object({
      version: z.string(),
      dialect: z.literal("postgresql"),
      entries: z.array(
        z.object({
          idx: z.number(),
          version: z.string(),
          when: z.number(),
          tag: z.string(),
          breakpoints: z.boolean(),
        }),
      ),
    })
    .parse(JSON.parse(await readFile(path.join(migrations, "meta/_journal.json"), "utf8")));
  const through15 = { ...journal, entries: journal.entries.filter((entry) => entry.idx <= 15) };
  const through14 = { ...journal, entries: journal.entries.filter((entry) => entry.idx <= 14) };
  journal.entries = journal.entries.filter((entry) => entry.idx <= 13);
  await mkdir(path.join(directory, "meta"));
  await writeFile(path.join(directory, "meta/_journal.json"), JSON.stringify(journal));
  for (const entry of journal.entries) {
    await copyFile(
      path.join(migrations, `${entry.tag}.sql`),
      path.join(directory, `${entry.tag}.sql`),
    );
  }
  const config = path.join(directory, "drizzle.config.cjs");
  await writeFile(
    config,
    `module.exports = {dialect:"postgresql",out:${JSON.stringify(directory)},dbCredentials:{url:process.env.DATABASE_URL}};`,
  );
  return { config, through14, through15 };
}

async function seedLegacyGeneration(sql: postgres.Sql) {
  const userId = crypto.randomUUID();
  const orgId = crypto.randomUUID();
  const jobId = crypto.randomUUID();
  const itemId = crypto.randomUUID();
  const key = crypto.randomUUID();
  const assetId = crypto.randomUUID();
  await sql.begin(async (tx) => {
    await tx`insert into users(id,auth_subject) values(${userId},${`migration-${userId}`})`;
    await tx`insert into organizations(id,name) values(${orgId},'migration-fixture')`;
    await tx`insert into organization_members(organization_id,user_id) values(${orgId},${userId})`;
    await tx`insert into media_assets(id,organization_id,user_id,kind,object_key,mime_type,width,height,bytes,sha256)
        values(${assetId},${orgId},${userId},'output',${`fixture/${assetId}`},'image/png',2,2,67,${"0".repeat(64)})`;
    await tx`insert into image_api_keys(organization_id,user_id,token_hash,expires_at)
        values(${orgId},${userId},${crypto.randomUUID()},now()+interval '1 day')`;
    await tx`insert into image_jobs(id,organization_id,user_id,idempotency_key,input_hash,input,model,prompt,resolution,aspect_ratio,requested_count,unit_credits,status)
        values(${jobId},${orgId},${userId},${key},'fixture','{}','fixture','fixture','1K','1:1',1,20,'failed')`;
    await tx`insert into image_job_items(id,job_id,organization_id,position,status)
        values(${itemId},${jobId},${orgId},0,'failed')`;
    await tx`update image_job_items set output_asset_id=${assetId} where id=${itemId}`;
    await tx`insert into image_local_edits(job_id,organization_id,user_id,source_asset_id)
        values(${jobId},${orgId},${userId},${assetId})`;
    await tx`insert into image_credit_ledger(organization_id,job_id,item_id,event_type,amount)
        values(${orgId},${jobId},${itemId},'reserve',-20)`;
    await tx`insert into image_outbox(item_id,dispatched_at) values(${itemId},now())`;
    await tx`insert into image_events(organization_id,kind,resource_id) values(${orgId},'task',${jobId})`;
    await tx`insert into image_retries(organization_id,user_id,job_id,idempotency_key)
        values(${orgId},${userId},${jobId},${crypto.randomUUID()})`;
  });
  return { orgId, userId, key, jobId, itemId, assetId };
}

async function verifyGenerationContraction(
  sql: postgres.Sql,
  root: string,
  databaseUrl: string,
  directory: string,
  through15: {
    entries: { idx: number; version: string; when: number; tag: string; breakpoints: boolean }[];
    version: string;
    dialect: "postgresql";
  },
  migrations: string,
  migrate: (config?: string) => void,
  config: string,
  capture: (table: string) => Promise<TableSnapshot>,
  before: TableSnapshot[],
  linked: string[],
  linkedBefore: TableSnapshot[],
  orgId: string,
  userId: string,
  key: string,
  jobId: string,
  itemId: string,
) {
  await sql`create view legacy_dependency_fixture as select id from image_jobs`;
  const blocked = spawnSync("pnpm", ["--filter", "@lycoboai/db", "db:migrate"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });
  assert.notEqual(blocked.status, 0);
  const legacyNames = ["image_assets", ...tables.map(([old]) => old)];
  const assertAliases = async (present: boolean) => {
    for (const name of legacyNames) {
      const [relation] = await sql`select to_regclass(${`public.${name}`})::text as name`;
      assert.equal(relation?.name !== null, present);
    }
  };
  await assertAliases(true);
  await sql`drop view legacy_dependency_fixture`;
  await writeFile(path.join(directory, "meta/_journal.json"), JSON.stringify(through15));
  const contraction = through15.entries.find((entry) => entry.idx === 15);
  assert.ok(contraction);
  await copyFile(
    path.join(migrations, `${contraction.tag}.sql`),
    path.join(directory, `${contraction.tag}.sql`),
  );
  migrate(config);
  await assertAliases(false);
  for (const [index, [, current]] of tables.entries()) {
    assert.deepEqual(await capture(current), before[index], `${current} must survive view removal`);
  }
  for (const [index, current] of linked.entries()) {
    assert.deepEqual(
      await capture(current),
      linkedBefore[index],
      `${current} must keep asset/edit links`,
    );
  }
  const staleFunctions =
    await sql`select proname from pg_proc where pronamespace='public'::regnamespace
      and prosrc ~ ${"\\mimage_(assets|jobs|job_items|outbox|events|retries|api_keys|credit_ledger)\\M"}`;
  assert.equal(staleFunctions.length, 0);
  // Conflict-based idempotency and partial refund uniqueness must survive the rename.
  const replay = await sql`insert into generation_jobs
      (organization_id,user_id,idempotency_key,input_hash,input,model,prompt,resolution,aspect_ratio,requested_count,unit_credits)
      values(${orgId},${userId},${key},'fixture','{}','fixture','fixture','1K','1:1',1,20)
      on conflict(organization_id,user_id,idempotency_key) do nothing returning id`;
  assert.equal(replay.length, 0);
  const refund = () => sql`insert into generation_credit_ledger
      (organization_id,job_id,item_id,event_type,amount) values(${orgId},${jobId},${itemId},'refund',20)
      on conflict do nothing returning id`;
  assert.equal((await refund()).length, 1);
  assert.equal((await refund()).length, 0);
}
