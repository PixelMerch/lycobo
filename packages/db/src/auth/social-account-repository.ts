import type postgres from "postgres";
import { z } from "zod";
import { ensureWallet } from "../wallet/wallet-repository";

const accountSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  credential_version: z.uuid(),
  disabled_at: z.coerce.date().nullable(),
});
const identifier = z.object({ id: z.uuid() });

async function provision(
  tx: postgres.TransactionSql,
  externalId: string,
  email: string | null,
  nickname: string | null,
) {
  const [user] =
    await tx`insert into users (auth_subject,nickname) values (${`supabase:${externalId}`},${nickname}) returning id`;
  const [organization] =
    await tx`insert into organizations (name) values ('Personal') returning id`;
  const userId = identifier.parse(user).id;
  const organizationId = identifier.parse(organization).id;
  await tx`insert into organization_members (organization_id,user_id,role)
    values (${organizationId},${userId},'member')`;
  await ensureWallet(tx, { organizationId, userId });
  const [account] =
    await tx`insert into social_accounts (supabase_user_id,user_id,organization_id,email)
    values (${externalId},${userId},${organizationId},${email}) returning id,user_id,credential_version,disabled_at`;
  return accountSchema.parse(account);
}

/** 按认证 UUID 原子开户并签发会话记录；邮箱只用于展示。 */
export function createSocialSession(
  sql: postgres.Sql,
  input: {
    sessionId: string;
    externalId: string;
    email: string | null;
    nickname?: string;
    expiresAt: Date;
    refreshHash: string;
  },
) {
  return sql.begin(async (tx) => {
    // 同一 Supabase 用户同时登录时，只创建一个业务用户和个人空间。
    await tx`select pg_advisory_xact_lock(hashtextextended(${input.externalId}, 1))`;
    const [existing] = await tx`select id,user_id,credential_version,disabled_at
      from social_accounts where supabase_user_id=${input.externalId} for update`;
    const account = existing
      ? accountSchema.parse(existing)
      : await provision(tx, input.externalId, input.email, input.nickname ?? null);
    if (account.disabled_at) return false;
    // 旧账号首次拿到第三方昵称时才补齐，保留用户已设置的名称。
    if (existing && input.nickname)
      await tx`update users set nickname=${input.nickname}
        where id=${account.user_id} and nickname is null`;
    await tx`insert into enterprise_sessions (id,social_account_id,expires_at,credential_version,refresh_token_hash)
      values (${input.sessionId},${account.id},${input.expiresAt},${account.credential_version},${input.refreshHash})`;
    return true;
  });
}
