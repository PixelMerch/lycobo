import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { enterpriseLoginResponseSchema, unwrapApiData } from "@lycoboai/contracts";
import { openAuthRepository, openImageRepository } from "@lycoboai/db";
import { imageStore } from "@lycoboai/storage";
import postgres from "postgres";
import { createApp } from "../src/app";
import { hashPassword } from "../src/features/auth/password";
import { enterpriseAuth } from "../src/features/auth/service";

if (process.env.ALLOW_LOCAL_INTEGRATION !== "true")
  throw new Error("Explicit isolated test opt-in required");
const base = new URL(process.env.DATABASE_URL ?? "");
if (
  !["postgres:", "postgresql:"].includes(base.protocol) ||
  !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)
)
  throw new Error("Only loopback PostgreSQL allowed");
const dbName = `auth_test_${crypto.randomUUID().replaceAll("-", "")}`;
const admin = postgres(base.href, { max: 1 });
const testUrl = new URL(base);
testUrl.pathname = `/${dbName}`;
const directory = await mkdtemp(path.join(tmpdir(), "lycobo-auth-test-"));
let authDb: ReturnType<typeof openAuthRepository> | undefined;
let images: ReturnType<typeof openImageRepository> | undefined;
try {
  await admin.unsafe(`create database "${dbName}"`);
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const migrated = spawnSync("pnpm", ["--filter", "@lycoboai/db", "db:migrate"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: testUrl.href },
    stdio: "pipe",
  });
  if (migrated.status !== 0) throw new Error("Isolated migration failed");
  authDb = openAuthRepository(testUrl.href);
  images = openImageRepository(testUrl.href);
  const sql = postgres(testUrl.href, { max: 1 });
  try {
    const first = await images.provision(`test:${crypto.randomUUID()}`, "test-enterprise-one", 10);
    const second = await images.provision(`test:${crypto.randomUUID()}`, "test-enterprise-two", 10);
    const password = `test-only-${crypto.randomUUID()}`;
    await authDb.setCredential(
      "fixture-account",
      first.userId,
      first.organizationId,
      await hashPassword(password),
    );
    await assert.rejects(
      authDb.setCredential(
        "fixture-account",
        second.userId,
        second.organizationId,
        await hashPassword(password),
      ),
    );
    const origin = "http://localhost:5173";
    const auth = enterpriseAuth(authDb, {
      secret: crypto.randomUUID() + crypto.randomUUID(),
      origins: [origin],
      secureCookie: false,
    });
    const store = imageStore(directory);
    await store.ready();
    const app = createApp(
      undefined,
      {
        repository: images,
        store,
        auth,
        enabled: false,
        unitCredits: 1,
        validate: () => {},
        resolutions: () => ["1K"],
      },
      auth,
    );
    const login = () =>
      app.request("/api/v1/auth/enterprise/login", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({ account: "FIXTURE-ACCOUNT", password }),
      });
    const response = await login();
    assert.equal(response.status, 200);
    const result = enterpriseLoginResponseSchema.parse(unwrapApiData(await response.json()));
    assert.equal(result.user.organizationId, first.organizationId);
    const headers = { Authorization: `Bearer ${result.accessToken}` };
    const cookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
    assert.equal((await app.request("/api/v1/image-models", { headers })).status, 200);
    assert.equal(
      (
        await app.request("/api/v1/image-session", {
          method: "POST",
          headers: { Cookie: cookie, Origin: origin },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await app.request("/api/v1/image-session", {
          method: "POST",
          headers: { Cookie: cookie, Origin: "https://hostile.example" },
        })
      ).status,
      401,
    );
    const job = await images.create(
      { userId: second.userId, organizationId: second.organizationId },
      {
        model: "gpt-image-2.5",
        prompt: "isolated fixture",
        resolution: "1K",
        aspectRatio: "1:1",
        count: 1,
        referenceAssetIds: [],
      },
      crypto.randomUUID(),
      1,
    );
    assert.equal((await app.request(`/api/v1/image-tasks/${job.id}`, { headers })).status, 404);
    // Existing service API keys remain valid, while cookies never use local fallback.
    assert.equal(
      (
        await app.request("/api/v1/image-models", {
          headers: { Authorization: `Bearer ${second.token}` },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await app.request("/api/v1/image-models", {
          headers: { Cookie: "lycobo_image_session=invalid" },
        })
      ).status,
      401,
    );
    await sql`update enterprise_accounts set disabled_at=now() where account='fixture-account'`;
    assert.equal((await app.request("/api/v1/auth/session", { headers })).status, 401);
    await authDb.setCredential(
      "fixture-account",
      first.userId,
      first.organizationId,
      await hashPassword(password),
    );
    assert.equal((await app.request("/api/v1/auth/session", { headers })).status, 401);
    const fresh = enterpriseLoginResponseSchema.parse(unwrapApiData(await (await login()).json()));
    const freshHeaders = { Authorization: `Bearer ${fresh.accessToken}` };
    assert.equal(
      (await app.request("/api/v1/auth/logout", { method: "POST", headers: freshHeaders })).status,
      200,
    );
    assert.equal(
      (await app.request("/api/v1/auth/session", { headers: freshHeaders })).status,
      401,
    );
    const attempts = await Promise.all(
      Array.from({ length: 25 }, () => authDb?.allowLogin("rate-fixture")),
    );
    assert.equal(attempts.filter(Boolean).length, 10);
    console.info(
      "Enterprise auth integration passed: migrations, credentials, JWT, cookie/CSRF, tenant isolation, revocation and atomic limits",
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
} finally {
  await Promise.all([authDb?.close(), images?.close()]);
  await admin.unsafe(`drop database if exists "${dbName}"`);
  await admin.end({ timeout: 5 });
  await rm(directory, { recursive: true, force: true });
}
