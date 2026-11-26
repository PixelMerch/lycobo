import assert from "node:assert/strict";
import type { createApp } from "../src/app";

type App = ReturnType<typeof createApp>;
type Login = (password?: string, captchaToken?: string) => Response | Promise<Response>;

/** 从隔离测试的登录响应提取指定 Cookie。 */
export function cookieOf(response: Response, name: string) {
  return (
    response.headers
      .getSetCookie()
      .find((value) => value.startsWith(`${name}=`))
      ?.split(";")[0] ?? ""
  );
}

/** 失败登录保留现有会话，成功登录同时撤销旧访问和刷新凭据。 */
export async function verifyPasswordSessionReplacement(
  app: App,
  origin: string,
  login: Login,
  previous: Response,
) {
  const cookie = cookieOf(previous, "lycobo_enterprise_session");
  const refreshCookie = cookieOf(previous, "lycobo_enterprise_refresh");
  assert.ok(cookie && refreshCookie);
  const session = (headers: HeadersInit) => app.request("/api/v1/auth/session", { headers });
  assert.equal((await login("wrong-fixture-password")).status, 401);
  assert.equal((await login(undefined, "invalid-turnstile-token")).status, 403);
  assert.equal((await session({ Cookie: cookie })).status, 200);
  const next = await login();
  assert.equal(next.status, 200);
  assert.equal((await session({ Authorization: `Bearer ${cookie.split("=")[1]}` })).status, 401);
  assert.equal((await session({ Cookie: cookie })).status, 401);
  const refresh = await app.request("/api/v1/auth/refresh", {
    method: "POST",
    headers: { Origin: origin, Cookie: refreshCookie },
  });
  assert.equal(refresh.status, 401);
  return next;
}

/** 两个并发请求全部结束后，检查最多仅一个客户端能继续调用受保护接口。 */
export async function verifyConcurrentPasswordSessions(app: App, login: Login) {
  const attempts = await Promise.all([login(), login()]);
  const active = await Promise.all(
    attempts.map(async (attempt) => {
      if (attempt.status !== 200) {
        assert.equal(attempt.status, 401);
        return false;
      }
      const cookie = cookieOf(attempt, "lycobo_enterprise_session");
      assert.ok(cookie);
      return (await app.request("/api/v1/auth/session", { headers: { Cookie: cookie } })).ok;
    }),
  );
  assert.equal(active.filter(Boolean).length, 1);
}
