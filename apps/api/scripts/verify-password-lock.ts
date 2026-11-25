import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type postgres from "postgres";
import type { createApp } from "../src/app";

/** 构造集成测试请求，每次使用独立的模拟挑战令牌。 */
export function passwordLoginFixture(
  app: ReturnType<typeof createApp>,
  origin: string,
  password: string,
) {
  return (submittedPassword = password, captchaToken = `fixture-token-${crypto.randomUUID()}`) =>
    app.request("/api/v1/auth/enterprise/login", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        account: "FIXTURE-ACCOUNT",
        password: submittedPassword,
        captchaToken,
      }),
    });
}

/** 验证一次性挑战、并发失败锁定、锁定到期和会话签发。 */
export async function verifyPasswordLock(
  sql: postgres.Sql,
  login: (password?: string, captchaToken?: string) => Response | Promise<Response>,
) {
  const repeatedToken = `fixture-token-${crypto.randomUUID()}`;
  const replay = await Promise.all([
    login(undefined, repeatedToken),
    login(undefined, repeatedToken),
  ]);
  assert.deepEqual(replay.map((response) => response.status).sort(), [200, 403]);
  const failures = () => login("wrong-fixture-password");
  assert.equal((await failures()).status, 401);
  assert.equal((await login()).status, 200);
  const passwordFailures = await Promise.all(Array.from({ length: 5 }, failures));
  assert.deepEqual(
    passwordFailures.map((attempt) => attempt.status).sort(),
    [401, 401, 401, 401, 429],
  );
  assert.equal(
    passwordFailures.find((attempt) => attempt.status === 429)?.headers.get("Retry-After"),
    "3600",
  );
  const locked = await login();
  assert.equal(locked.status, 429);
  assert.equal(locked.headers.get("set-cookie"), null);
  const lockKey = createHash("sha256").update("password-login:fixture-account").digest("hex");
  await sql`update login_rate_limits set window_start=clock_timestamp()-interval '1 hour' where key=${lockKey}`;
}
