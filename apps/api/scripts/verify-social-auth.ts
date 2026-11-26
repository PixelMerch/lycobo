import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  enterpriseIdentitySchema,
  socialAuthorizationSchema,
  unwrapApiData,
} from "@lycoboai/contracts";
import type { RealtimeRepository } from "@lycoboai/db";
import type { createApp } from "../src/app";

type App = ReturnType<typeof createApp>;

function cookie(response: Response, name: string) {
  const value = response.headers.getSetCookie().find((item) => item.startsWith(`${name}=`));
  assert.ok(value);
  return value.split(";")[0] ?? "";
}

async function start(app: App, origin: string, provider: "google" | "apple") {
  const response = await app.request("/api/v1/auth/oauth/start", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ provider, returnTo: "/zh-CN/commerce/create?test=1#preview" }),
  });
  assert.equal(response.status, 200);
  const { url } = socialAuthorizationSchema.parse(unwrapApiData(await response.json()));
  const authUrl = new URL(url);
  assert.equal(authUrl.searchParams.get("provider"), provider);
  assert.equal(authUrl.searchParams.get("redirect_to"), `${origin}/api/v1/auth/oauth/callback`);
  return {
    flow: cookie(response, "lycobo_oauth_flow"),
    challenge: authUrl.searchParams.get("code_challenge"),
  };
}

async function complete(app: App, flow: string) {
  const result = await app.request("/api/v1/auth/oauth/callback?code=test-code", {
    headers: { Cookie: flow },
  });
  assert.equal(result.status, 302);
  const location = new URL(result.headers.get("location") ?? "", "http://localhost");
  assert.equal(location.pathname, "/zh-CN/login");
  assert.equal(location.searchParams.get("returnTo"), "/zh-CN/commerce/create?test=1#preview");
  const headers = { Cookie: cookie(result, "lycobo_enterprise_session") };
  const session = await app.request("/api/v1/auth/session", { headers });
  assert.equal(session.status, 200);
  const user = enterpriseIdentitySchema.parse(unwrapApiData(await session.json()));
  assert.match(user.uid ?? "", /^\d{10}$/);
  assert.equal(user.loginMethod, "social");
  return { user, headers, refresh: cookie(result, "lycobo_enterprise_refresh") };
}

/** 在隔离数据库验证 PKCE、账号归属及同一第三方账号的单设备会话。 */
export async function verifySocialAuth(
  app: App,
  origin: string,
  enterpriseUserId: string,
  activeSessions: RealtimeRepository["sessions"],
) {
  const externalId = crypto.randomUUID();
  const google = await start(app, origin, "google");
  const apple = await start(app, origin, "apple");
  const returningGoogle = await start(app, origin, "google");
  assert.notEqual(google.challenge, apple.challenge);
  const noFlow = await app.request("/api/v1/auth/oauth/callback?code=test-code");
  assert.match(noFlow.headers.get("location") ?? "", /oauth=failed/);
  const original = globalThis.fetch;
  let exchange = 0;
  globalThis.fetch = async (url, options) => {
    assert.equal(
      String(url),
      "https://abcdefghijklmnopqrst.supabase.co/auth/v1/token?grant_type=pkce",
    );
    const payload = JSON.parse(String(options?.body));
    assert.equal(payload.auth_code, "test-code");
    const expected = [google.challenge, apple.challenge, returningGoogle.challenge][exchange++];
    assert.equal(createHash("sha256").update(payload.code_verifier).digest("base64url"), expected);
    return Response.json({
      user: {
        id: externalId,
        email: "fixture-account@example.com",
        identities: [
          { provider: "google", identity_data: { full_name: "Google Fixture" } },
          { provider: "apple" },
        ],
      },
    });
  };
  try {
    const first = await complete(app, google.flow);
    assert.equal(first.user.nickname, "Google Fixture");
    const previous = await activeSessions(first.user.organizationId);
    assert.equal(previous.length, 1);
    const rename = await app.request("/api/v1/auth/nickname", {
      method: "PUT",
      headers: { ...first.headers, Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: "  我的昵称  " }),
    });
    assert.equal(rename.status, 200);
    assert.equal(
      enterpriseIdentitySchema.parse(unwrapApiData(await rename.json())).nickname,
      "我的昵称",
    );
    const second = await complete(app, apple.flow);
    assert.equal(second.user.nickname, "我的昵称");
    const returning = await complete(app, returningGoogle.flow);
    assert.equal(returning.user.nickname, "我的昵称");
    assert.equal(first.user.userId, second.user.userId);
    assert.equal(first.user.uid, second.user.uid);
    assert.equal(first.user.organizationId, second.user.organizationId);
    assert.notEqual(first.user.userId, enterpriseUserId);
    const latest = await activeSessions(first.user.organizationId);
    assert.equal(latest.length, 1);
    assert.notDeepEqual(latest, previous);
    const refresh = (cookie: string) =>
      app.request("/api/v1/auth/refresh", {
        method: "POST",
        headers: { Origin: origin, Cookie: cookie },
      });
    assert.equal((await refresh(second.refresh)).status, 401);
    assert.equal((await refresh(returning.refresh)).status, 200);
    const logout = await app.request("/api/v1/auth/logout", {
      method: "POST",
      headers: { Origin: origin, Cookie: first.headers.Cookie },
    });
    assert.equal(logout.status, 200);
    assert.equal(
      (await app.request("/api/v1/auth/session", { headers: first.headers })).status,
      401,
    );
    assert.equal(
      (await app.request("/api/v1/auth/session", { headers: returning.headers })).status,
      200,
    );
    assert.equal(exchange, 3);
  } finally {
    globalThis.fetch = original;
  }
}
