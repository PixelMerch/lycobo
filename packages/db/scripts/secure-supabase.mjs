import { readFile } from "node:fs/promises";
import postgres from "postgres";

/** Keep the existing server-authorized tables inaccessible to Supabase client roles. */
export async function secureSupabase(url) {
  const journal = JSON.parse(
    await readFile(new URL("../migrations/meta/_journal.json", import.meta.url), "utf8"),
  );
  const latest = journal.entries.at(-1);
  if (!latest || !Number.isInteger(latest.idx)) throw new Error("迁移结构元数据无效。");
  const snapshot = JSON.parse(
    await readFile(
      new URL(
        `../migrations/meta/${String(latest.idx).padStart(4, "0")}_snapshot.json`,
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const tables = Object.keys(snapshot.tables);
  if (!tables.length || tables.some((table) => !/^public\.[a-z_][a-z0-9_]*$/.test(table))) {
    throw new Error("业务表元数据无效。");
  }
  const sql = postgres(url, { max: 1, connect_timeout: 10, idle_timeout: 5, prepare: false });
  try {
    await sql.begin(async (tx) => {
      await tx`set local lock_timeout = '5s'`;
      await tx`set local statement_timeout = '30s'`;
      const roles =
        await tx`select rolname from pg_roles where rolname in ('anon','authenticated')`;
      const grantees = ["PUBLIC", ...roles.map((role) => `"${role.rolname}"`)].join(", ");
      for (const table of tables) {
        const name = `"public"."${table.slice("public.".length)}"`;
        await tx.unsafe(`ALTER TABLE ${name} ENABLE ROW LEVEL SECURITY`);
        await tx.unsafe(`REVOKE ALL PRIVILEGES ON TABLE ${name} FROM ${grantees}`);
      }
      // Identity sequences and public RPC entry points are separate privileges.
      const sequences = await tx`select s.relname from pg_class s
        join pg_depend d on d.objid=s.oid and d.classid='pg_class'::regclass and d.refclassid='pg_class'::regclass and d.deptype in ('a','i')
        join pg_class t on t.oid=d.refobjid join pg_namespace n on n.oid=t.relnamespace
        where s.relkind='S' and n.nspname='public' and t.relname = any(${tables.map((table) => table.slice(7))})`;
      for (const sequence of sequences) {
        const name = sequence.relname.replaceAll('"', '""');
        await tx.unsafe(`REVOKE ALL PRIVILEGES ON SEQUENCE "public"."${name}" FROM ${grantees}`);
      }
      const functions = await tx`select p.oid::regprocedure::text as signature from pg_proc p
        join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
        and p.proname in ('allocate_public_identifier', 'prevent_wallet_entry_mutation',
          'validate_wallet_entry_scope', 'lycobo_prompt_optimization',
          'lycobo_provider_webhook', 'lycobo_video_operation')
        and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')`;
      for (const fn of functions) {
        await tx.unsafe(`REVOKE EXECUTE ON FUNCTION ${fn.signature} FROM ${grantees}`);
      }
    });
    return tables.length;
  } finally {
    await sql.end({ timeout: 5 });
  }
}
