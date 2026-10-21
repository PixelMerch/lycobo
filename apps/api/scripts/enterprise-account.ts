import { enterpriseAccountSchema } from "@lycoboai/contracts";
import { openAuthRepository } from "@lycoboai/db";
import { z } from "zod";
import { hashPassword } from "../src/features/auth/password";

const input = z
  .object({
    DATABASE_URL: z.url(),
    ENTERPRISE_ACCOUNT: enterpriseAccountSchema,
    ENTERPRISE_PASSWORD: z.string().min(1).max(256),
    ENTERPRISE_USER_ID: z.uuid(),
    ENTERPRISE_ORGANIZATION_ID: z.uuid(),
  })
  .safeParse(process.env);
if (!input.success)
  throw new Error(
    "Set DATABASE_URL, ENTERPRISE_ACCOUNT, ENTERPRISE_PASSWORD (12–256 chars), ENTERPRISE_USER_ID and ENTERPRISE_ORGANIZATION_ID",
  );
const localWeakPassword =
  process.env.ENTERPRISE_ALLOW_WEAK_PASSWORD === "true" &&
  process.env.NODE_ENV === "development" &&
  ["localhost", "127.0.0.1", "[::1]"].includes(new URL(input.data.DATABASE_URL).hostname);
if (input.data.ENTERPRISE_PASSWORD.length < 12 && !localWeakPassword)
  throw new Error("Enterprise password must contain at least 12 characters");
const repository = openAuthRepository(input.data.DATABASE_URL);
try {
  const passwordHash = await hashPassword(input.data.ENTERPRISE_PASSWORD);
  await repository.setCredential(
    input.data.ENTERPRISE_ACCOUNT,
    input.data.ENTERPRISE_USER_ID,
    input.data.ENTERPRISE_ORGANIZATION_ID,
    passwordHash,
  );
  console.info("企业账号已配置，旧登录会话已撤销。");
} finally {
  delete process.env.ENTERPRISE_PASSWORD;
  await repository.close();
}
