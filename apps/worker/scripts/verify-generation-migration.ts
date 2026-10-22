import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { z } from "zod";

const tables = [
  ["image_api_keys", "generation_api_keys"],
  ["image_jobs", "generation_jobs"],
  ["image_job_items", "generation_job_items"],
  ["image_credit_ledger", "generation_credit_ledger"],
  ["image_outbox", "generation_outbox"],
  ["image_events", "generation_events"],
  ["image_retries", "generation_retries"],
] as const;

// Runs only in the disposable database created by check-image-integration.ts.
export async function verifyGenerationMigration(databaseUrl: string) {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
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
    migrate(config);
    const userId = crypto.randomUUID();
    const orgId = crypto.randomUUID();
    const jobId = crypto.randomUUID();
    const itemId = crypto.randomUUID();
    const key = crypto.randomUUID();
    await sql.begin(async (tx) => {
      await tx`insert into users(id,auth_subject) values(${userId},${`migration-${userId}`})`;
      await tx`insert into organizations(id,name) values(${orgId},'migration-fixture')`;
      await tx`insert into organization_members(organization_id,user_id) values(${orgId},${userId})`;
      await tx`insert into image_api_keys(organization_id,user_id,token_hash,expires_at)
        values(${orgId},${userId},${crypto.randomUUID()},now()+interval '1 day')`;
      await tx`insert into image_jobs(id,organization_id,user_id,idempotency_key,input_hash,input,model,prompt,resolution,aspect_ratio,requested_count,unit_credits,status)
        values(${jobId},${orgId},${userId},${key},'fixture','{}','fixture','fixture','1K','1:1',1,20,'failed')`;
      await tx`insert into image_job_items(id,job_id,organization_id,position,status)
        values(${itemId},${jobId},${orgId},0,'failed')`;
      await tx`insert into image_credit_ledger(organization_id,job_id,item_id,event_type,amount)
        values(${orgId},${jobId},${itemId},'reserve',-20)`;
      await tx`insert into image_outbox(item_id,dispatched_at) values(${itemId},now())`;
      await tx`insert into image_events(organization_id,kind,resource_id) values(${orgId},'task',${jobId})`;
      await tx`insert into image_retries(organization_id,user_id,job_id,idempotency_key)
        values(${orgId},${userId},${jobId},${crypto.randomUUID()})`;
    });
    const capture = async (table: string) => {
      const [row] = await sql`select ${table}::regclass::oid::text as oid`;
      return { oid: row?.oid, rows: await sql`select * from ${sql(table)} order by id` };
    };
    const before = await Promise.all(tables.map(([old]) => capture(old)));
    migrate();
    for (const [index, [old, current]] of tables.entries()) {
      assert.deepEqual(
        await capture(current),
        before[index],
        `${current} must preserve OID and rows`,
      );
      assert.deepEqual(await sql`select * from ${sql(old)} order by id`, before[index]?.rows);
    }
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
    await sql.begin(async (tx) => {
      await tx`delete from generation_outbox where item_id=${itemId}`;
      await tx`delete from generation_retries where organization_id=${orgId}`;
      await tx`delete from generation_credit_ledger where organization_id=${orgId}`;
      await tx`delete from generation_job_items where job_id=${jobId}`;
      await tx`delete from generation_jobs where id=${jobId}`;
      await tx`delete from generation_api_keys where organization_id=${orgId}`;
      await tx`delete from generation_events where organization_id=${orgId}`;
      await tx`delete from organization_members where organization_id=${orgId}`;
      await tx`delete from organizations where id=${orgId}`;
      await tx`delete from users where id=${userId}`;
    });
    console.log(
      "Generation naming upgrade preserved relation identity, existing rows, legacy reads and idempotent writes",
    );
  } finally {
    await sql.end({ timeout: 5 });
    await rm(directory, { recursive: true, force: true });
  }
}
