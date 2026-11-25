import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  enterpriseIdentitySchema,
  enterpriseLoginResponseSchema,
  unwrapApiData,
} from "@lycoboai/contracts";
import { openAuthRepository, openImageRepository, openRealtimeRepository } from "@lycoboai/db";
import { imageStore } from "@lycoboai/storage";
import postgres from "postgres";
import { createApp } from "../src/app";
import { hashPassword } from "../src/features/auth/password";
import { enterpriseAuth } from "../src/features/auth/service";
import { passwordLoginFixture, verifyPasswordLock } from "./verify-password-lock";
import { verifySocialAuth } from "./verify-social-auth";

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
let realtime: ReturnType<typeof openRealtimeRepository> | undefined;
try {
  await admin.unsafe(`create database "${dbName}"`);
  const root = fileURLToPath(new URL("../../../", import.meta.url).href);
  const migrated = spawnSync("pnpm", ["--filter", "@lycoboai/db", "db:migrate"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: testUrl.href },
    stdio: "pipe",
  });
  if (migrated.status !== 0) throw new Error("Isolated migration failed");
  authDb = openAuthRepository(testUrl.href);
  images = openImageRepository(testUrl.href);
  realtime = openRealtimeRepository(testUrl.href);
  const sql = postgres(testUrl.href, { max: 5 });
  try {
    const patterns = { user: /^[0-9]{10}$/, task: /^W[0-9A-Z]{8}$/, image: /^P[0-9A-Z]{8}$/ };
    for (const [kind, pattern] of Object.entries(patterns)) {
      const allocated = await Promise.all(
        Array.from({ length: 50 }, async () => {
          const [row] = await sql`select public.allocate_public_identifier(${kind}) as value`;
          const value = String(row?.value);
          assert.match(value, pattern);
          return value;
        }),
      );
      assert.equal(new Set(allocated).size, allocated.length);
    }
    await assert.rejects(sql`select public.allocate_public_identifier('invalid')`);
    const first = await images.provision(`test:${crypto.randomUUID()}`, "test-enterprise-one", 200);
    const second = await images.provision(
      `test:${crypto.randomUUID()}`,
      "test-enterprise-two",
      200,
    );
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
    const auth = enterpriseAuth(
      authDb,
      {
        secret: crypto.randomUUID() + crypto.randomUUID(),
        origins: [origin],
        secureCookie: false,
        passwordTurnstile: { siteKey: "fixture-site-key", secret: "fixture-secret" },
        oauth: {
          origin: "https://abcdefghijklmnopqrst.supabase.co",
          key: "sb_publishable_fixture",
          providers: ["google", "apple"],
        },
      },
      async (_secret, token) => token.startsWith("fixture-token-"),
    );
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
        validate: () => undefined,
        resolutions: () => ["1K"],
      },
      auth,
      undefined,
      undefined,
      { repository: realtime, auth },
    );
    const login = passwordLoginFixture(app, origin, password);
    await verifyPasswordLock(sql, login);
    const response = await login();
    assert.equal(response.status, 200);
    const result = enterpriseLoginResponseSchema.parse(unwrapApiData(await response.json()));
    assert.equal(result.user.organizationId, first.organizationId);
    assert.match(result.user.uid ?? "", /^[0-9]{10}$/);
    assert.equal(result.user.uid, first.uid);
    assert.notEqual(first.uid, second.uid);
    await verifySocialAuth(app, origin, first.userId);
    const headers = { Authorization: `Bearer ${result.accessToken}` };
    const session = enterpriseIdentitySchema.parse(
      unwrapApiData(await (await app.request("/api/v1/auth/session", { headers })).json()),
    );
    assert.equal(session.uid, first.uid);
    // 预设头像存在 users 表：只改当前会话的用户，会话读取带回同一个值，格式约束拒绝非法 id。
    assert.equal(session.avatarPreset, null);
    const savedAvatar = await app.request("/api/v1/auth/avatar", {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ avatarPreset: "sky" }),
    });
    assert.equal(savedAvatar.status, 200);
    const withAvatar = enterpriseIdentitySchema.parse(
      unwrapApiData(await (await app.request("/api/v1/auth/session", { headers })).json()),
    );
    assert.equal(withAvatar.avatarPreset, "sky");
    const [otherUser] = await sql`select avatar_preset from users where id=${second.userId}`;
    assert.equal(otherUser?.avatar_preset ?? null, null);
    await assert.rejects(sql`update users set avatar_preset='Not Valid!' where id=${first.userId}`);
    // 新会话仍能读取保存的语言，另一个用户保持原偏好。
    assert.equal(session.preferredLocale, null);
    const savedLocale = await app.request("/api/v1/auth/locale", {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ preferredLocale: "zh-CN" }),
    });
    assert.equal(savedLocale.status, 200);
    const nextLogin = await login();
    assert.equal(nextLogin.status, 200);
    const nextUser = enterpriseLoginResponseSchema.parse(
      unwrapApiData(await nextLogin.json()),
    ).user;
    assert.equal(nextUser.preferredLocale, "zh-CN");
    assert.equal(nextUser.avatarPreset, "sky");
    const [otherLocale] = await sql`select preferred_locale from users where id=${second.userId}`;
    assert.equal(otherLocale?.preferred_locale, null);
    await assert.rejects(sql`update users set preferred_locale='fr' where id=${first.userId}`);
    const cookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
    // 本地没有 DO，公告仍公开可读，通知列表仍要求有效会话。
    const release = await app.request("/api/v1/realtime/release");
    assert.equal(release.status, 200);
    assert.deepEqual(unwrapApiData(await release.json()), { release: null });
    assert.equal((await app.request("/api/v1/notifications")).status, 401);
    const notifications = await app.request("/api/v1/notifications", {
      headers: { Cookie: cookie },
    });
    assert.equal(notifications.status, 200);
    assert.deepEqual(unwrapApiData(await notifications.json()), {
      data: [],
      unread: 0,
      nextCursor: null,
    });
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
    // 现有服务 API 密钥继续有效；Cookie 登录从不回退到本地身份。
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
    assert.equal(fresh.user.uid, first.uid);
    const freshHeaders = { Authorization: `Bearer ${fresh.accessToken}` };
    assert.equal(
      (await app.request("/api/v1/auth/logout", { method: "POST", headers: freshHeaders })).status,
      200,
    );
    assert.equal(
      (await app.request("/api/v1/auth/session", { headers: freshHeaders })).status,
      401,
    );
    // 刷新凭据只放 HttpOnly Cookie，原子轮换，有效期不超过最初登录的时限。
    const cookieOf = (response: Response, name: string) =>
      response.headers
        .getSetCookie()
        .find((value) => value.startsWith(`${name}=`))
        ?.split(";")[0] ?? "";
    const refresh = (cookie: string, requestOrigin = origin) =>
      app.request("/api/v1/auth/refresh", {
        method: "POST",
        headers: { Cookie: cookie, Origin: requestOrigin },
      });
    const loginResponse = await login();
    const persistent = enterpriseLoginResponseSchema.parse(
      unwrapApiData(await loginResponse.json()),
    );
    assert.equal(persistent.expiresIn, 86400);
    assert.ok(
      (persistent.refreshExpiresIn ?? 0) > 2591995 && (persistent.refreshExpiresIn ?? 0) <= 2592000,
    );
    const firstRefresh = cookieOf(loginResponse, "lycobo_enterprise_refresh");
    assert.ok(firstRefresh);
    assert.ok(
      loginResponse.headers
        .getSetCookie()
        .filter((value) => !value.startsWith("lycobo_image_session="))
        .every((value) => value.includes("HttpOnly")),
    );
    assert.equal((await refresh(firstRefresh, "https://hostile.example")).status, 403);
    const parallelRefresh = await Promise.all([refresh(firstRefresh), refresh(firstRefresh)]);
    assert.deepEqual(parallelRefresh.map((response) => response.status).sort(), [200, 401]);
    const rotated = parallelRefresh.find((response) => response.status === 200);
    assert.ok(rotated);
    const rotatedBody = unwrapApiData(await rotated.json());
    assert.ok(
      typeof rotatedBody === "object" && rotatedBody !== null && !("refreshToken" in rotatedBody),
    );
    const renewed = enterpriseLoginResponseSchema.parse(rotatedBody);
    const secondRefresh = cookieOf(rotated, "lycobo_enterprise_refresh");
    assert.notEqual(secondRefresh, firstRefresh);
    assert.equal((await refresh(firstRefresh)).status, 401);
    const refreshedHeaders = { Authorization: `Bearer ${renewed.accessToken}` };
    assert.equal(
      (await app.request("/api/v1/auth/session", { headers: refreshedHeaders })).status,
      200,
    );
    // 即使访问 Cookie 已过期或丢失，退出登录也必须撤销刷新会话。
    assert.equal(
      (
        await app.request("/api/v1/auth/logout", {
          method: "POST",
          headers: { Cookie: firstRefresh, Origin: origin },
        })
      ).status,
      200,
    );
    assert.equal((await refresh(secondRefresh)).status, 401);
    assert.equal(
      (await app.request("/api/v1/auth/session", { headers: refreshedHeaders })).status,
      401,
    );
    const passwordLogin = await login();
    const passwordToken = enterpriseLoginResponseSchema.parse(
      unwrapApiData(await passwordLogin.json()),
    );
    const passwordRefresh = cookieOf(passwordLogin, "lycobo_enterprise_refresh");
    const passwordHeaders = {
      Authorization: `Bearer ${passwordToken.accessToken}`,
      "Content-Type": "application/json",
    };
    assert.equal(
      (
        await app.request("/api/v1/auth/password", {
          method: "POST",
          headers: passwordHeaders,
          body: JSON.stringify({
            currentPassword: "wrong",
            newPassword: "new-fixture-password-123",
          }),
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await app.request("/api/v1/auth/password", {
          method: "POST",
          headers: passwordHeaders,
          body: JSON.stringify({
            currentPassword: password,
            newPassword: "new-fixture-password-123",
          }),
        })
      ).status,
      200,
    );
    assert.equal((await refresh(passwordRefresh)).status, 401);
    assert.equal(
      (await app.request("/api/v1/auth/session", { headers: passwordHeaders })).status,
      401,
    );
    assert.equal((await login()).status, 401);
    await authDb.setCredential(
      "fixture-account",
      first.userId,
      first.organizationId,
      await hashPassword(password),
    );
    const expirationLogin = await login();
    const expiringRefresh = cookieOf(expirationLogin, "lycobo_enterprise_refresh");
    await sql`update enterprise_sessions set expires_at=now()-interval '1 second'`;
    assert.equal((await refresh(expiringRefresh)).status, 401);
    const attempts = await Promise.all(
      Array.from({ length: 25 }, () => authDb?.allowLogin("rate-fixture")),
    );
    assert.equal(attempts.filter(Boolean).length, 10);
    const sameMailbox = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        authDb?.allowEmailCode("mailbox@example.invalid", `192.0.2.${index + 1}`, "send"),
      ),
    );
    assert.equal(sameMailbox.filter(Boolean).length, 5);
    const sameAddress = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        authDb?.allowEmailCode(`mailbox-${index}@example.invalid`, "198.51.100.1", "send"),
      ),
    );
    assert.equal(sameAddress.filter(Boolean).length, 15);
    assert.equal(
      await authDb?.allowEmailCode("mailbox@example.invalid", "192.0.2.1", "verify"),
      true,
    );
    console.info(
      "Enterprise auth integration passed: migrations, credentials, JWT, cookie/CSRF, tenant isolation, revocation and atomic limits",
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
} finally {
  await Promise.all([authDb?.close(), images?.close(), realtime?.close()]);
  await admin.unsafe(`drop database if exists "${dbName}"`);
  await admin.end({ timeout: 5 });
  await rm(directory, { recursive: true, force: true });
}
