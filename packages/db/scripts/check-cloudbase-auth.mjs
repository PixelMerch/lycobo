import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

if (process.env.ALLOW_LOCAL_INTEGRATION !== "true")
  throw new Error("Explicit isolated test opt-in required");
const base = new URL(process.env.DATABASE_URL ?? "");
if (
  !["postgres:", "postgresql:"].includes(base.protocol) ||
  !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)
)
  throw new Error("Only loopback PostgreSQL allowed");
const root = fileURLToPath(new URL("../../../", import.meta.url));
const dbName = `cloudbase_auth_${randomUUID().replaceAll("-", "")}`;
const admin = postgres(base.href, { max: 1 });
const testUrl = new URL(base);
testUrl.pathname = `/${dbName}`;
let sql;
try {
  await admin.unsafe(`create database "${dbName}"`);
  const migrated = spawnSync("pnpm", ["--filter", "@lycoboai/db", "db:migrate"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: testUrl.href },
    stdio: "pipe",
  });
  if (migrated.status !== 0) throw new Error("Isolated migration failed");
  sql = postgres(testUrl.href);
  try {
    await sql.unsafe(
      "DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$",
    );
    await sql.unsafe(
      "DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$",
    );
    await sql.unsafe(
      "DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$",
    );
    await sql.unsafe(
      await fs.readFile(
        new URL(
          "../../../cloudbase/migrations/20261031223400_auth_runtime_rpc.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const id = randomUUID(),
      org = randomUUID(),
      subject = `cloudbase-test:${id}`,
      account = `rpc-${id}`;
    try {
      await sql`insert into users(id,auth_subject) values(${id},${subject})`;
      await sql`insert into organizations(id,name,available_credits) values(${org},${account},0)`;
      await sql`insert into organization_members(organization_id,user_id,role) values(${org},${id},'admin')`;
      await sql`select lycobo_auth_set_credential(${account},${id},${org},'old-hash')`;
      const [{ a }] = await sql`select lycobo_auth_credential(${account}) a`;
      assert.equal(a.user_id, id);
      const session = randomUUID();
      const [bad] =
        await sql`select lycobo_auth_create_session(${session},${a.id},'wrong',now()+interval '1 hour','first') ok`;
      assert.equal(bad.ok, false);
      await sql`select lycobo_auth_create_session(${session},${a.id},'old-hash',now()+interval '1 hour','first')`;
      const rotations = await Promise.all([
        sql`select lycobo_auth_rotate_refresh('first','next-1') r`,
        sql`select lycobo_auth_rotate_refresh('first','next-2') r`,
      ]);
      assert.equal(rotations.filter((x) => x[0].r !== null).length, 1);
      const [{ identity }] = await sql`select lycobo_auth_identity(${session}) identity`;
      assert.equal(identity.organizationId, org);
      const [{ changed }] =
        await sql`select lycobo_auth_change_password(${a.id},'wrong','new-hash') changed`;
      assert.equal(changed, false);
      await sql`select lycobo_auth_change_password(${a.id},'old-hash','new-hash')`;
      assert.equal((await sql`select lycobo_auth_identity(${session}) identity`)[0].identity, null);
      for (const role of ["anon", "authenticated"]) {
        await assert.rejects(
          sql.begin(async (tx) => {
            await tx.unsafe(`set local role ${role}`);
            await tx`select lycobo_auth_credential(${account})`;
          }),
          { code: "42501" },
        );
      }
      console.log(
        "PASS: credential compare, single-use concurrent refresh, identity, atomic password/session revocation, anonymous/authenticated RPC denial",
      );
    } finally {
      await sql`delete from enterprise_sessions where account_id in(select id from enterprise_accounts where account=${account})`;
      await sql`delete from enterprise_accounts where account=${account}`;
      await sql`delete from organization_members where user_id=${id}`;
      await sql`delete from organizations where id=${org}`;
      await sql`delete from users where id=${id}`;
    }
  } finally {
    await sql.end();
  }
} finally {
  await sql?.end();
  await admin.unsafe(`drop database if exists "${dbName}" with (force)`);
  await admin.end();
}
