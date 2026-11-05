import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { supabaseMigrationTarget } from "../packages/db/scripts/supabase-target.mjs";

const project = "wjirihknptxjodgknbfy";
const base = {
  SUPABASE_PROJECT_REF: project,
  SUPABASE_DATABASE_URL: `postgresql://postgres:fixture-password@db.${project}.supabase.co:5432/postgres?sslmode=require`,
  DATABASE_URL: "postgresql://local:fixture-local-password@127.0.0.1:55432/local",
};

describe("Supabase migration target", () => {
  it("uses the dedicated target and leaves the runtime database untouched", () => {
    const target = supabaseMigrationTarget(base);
    expect(target.host).toBe(`db.${project}.supabase.co`);
    expect(new URL(target.url).password).toBe("fixture-password");
    expect(base.DATABASE_URL).toContain("127.0.0.1");
  });
  it("accepts a session pooler only when its login matches the explicit project", () => {
    const sessionUrl = `postgresql://postgres.${project}:fixture-password@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require`;
    const target = supabaseMigrationTarget({ ...base, SUPABASE_DATABASE_URL: sessionUrl });
    expect(target.host).toBe("aws-0-ap-southeast-1.pooler.supabase.com");
    for (const invalid of [
      sessionUrl.replace(`postgres.${project}`, "postgres.anotherprojectaaaaaa"),
      sessionUrl.replace(":5432/", ":6543/"),
      sessionUrl.replace("pooler.supabase.com", "pooler.supabase.com.example.com"),
    ]) {
      expect(() => supabaseMigrationTarget({ ...base, SUPABASE_DATABASE_URL: invalid })).toThrow(
        "迁移目标须为",
      );
    }
  });
  it.each(["", "[YOUR-PASSWORD]", "%5BYOUR-PASSWORD%5D"])(
    "rejects an unfilled password before connecting: %s",
    (password) => {
      expect(() =>
        supabaseMigrationTarget({
          ...base,
          SUPABASE_DATABASE_URL: base.SUPABASE_DATABASE_URL.replace("fixture-password", password),
        }),
      ).toThrow("请先替换");
    },
  );
  it.each([
    "postgresql://postgres:fixture-password@db.anotherprojectaaaaaa.supabase.co:5432/postgres?sslmode=require",
    "postgresql://postgres:fixture-password@127.0.0.1:5432/postgres?sslmode=require",
    `postgresql://postgres:fixture-password@db.${project}.supabase.co:6543/postgres?sslmode=require`,
    `postgresql://postgres:fixture-password@db.${project}.supabase.co:5432/another?sslmode=require`,
  ])("rejects a different project, local database, transaction pooler or database name", (url) => {
    expect(() => supabaseMigrationTarget({ ...base, SUPABASE_DATABASE_URL: url })).toThrow(
      "迁移目标须为",
    );
  });
  it("requires TLS and keeps a malformed URL out of error messages", () => {
    expect(() =>
      supabaseMigrationTarget({
        ...base,
        SUPABASE_DATABASE_URL: base.SUPABASE_DATABASE_URL.replace(
          "sslmode=require",
          "sslmode=disable",
        ),
      }),
    ).toThrow("sslmode");
    try {
      supabaseMigrationTarget({ ...base, SUPABASE_DATABASE_URL: "private-password-not-a-url" });
    } catch (error) {
      expect(error.message).not.toContain("private-password");
    }
  });
  it("keeps encoded password characters intact", () => {
    const url = base.SUPABASE_DATABASE_URL.replace("fixture-password", "test%40pass%23%2Fword");
    expect(
      new URL(supabaseMigrationTarget({ ...base, SUPABASE_DATABASE_URL: url }).url).password,
    ).toBe("test%40pass%23%2Fword");
  });
});

describe("Supabase migration command", () => {
  const entry = fileURLToPath(
    new URL("../packages/db/scripts/migrate-supabase.mjs", import.meta.url),
  );
  it("checks configuration without connecting and never prints the password", () => {
    const result = spawnSync(process.execPath, [entry, "--check"], {
      env: { ...process.env, ...base },
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("未连接数据库");
    expect(result.stdout + result.stderr).not.toContain("fixture-password");
    expect(result.stdout + result.stderr).not.toContain("fixture-local-password");
  });
  it("stops on a placeholder before starting the driver", () => {
    const result = spawnSync(process.execPath, [entry, "--check"], {
      env: {
        ...process.env,
        ...base,
        SUPABASE_DATABASE_URL: base.SUPABASE_DATABASE_URL.replace(
          "fixture-password",
          "[YOUR-PASSWORD]",
        ),
      },
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("尚未连接数据库");
    expect(result.stdout).toBe("");
  });
});

it.each(["&host=127.0.0.1", "&sslmode=disable"])(
  "does not permit query options to redirect or weaken the target: %s",
  (suffix) => {
    expect(() =>
      supabaseMigrationTarget({
        ...base,
        SUPABASE_DATABASE_URL: base.SUPABASE_DATABASE_URL + suffix,
      }),
    ).toThrow();
  },
);
