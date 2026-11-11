import { createHash } from "node:crypto";
import { type AccountLocale, accountLocales } from "@lycoboai/contracts";
import postgres from "postgres";
import { z } from "zod";
import type { ImagePrincipal } from "../images/image-repository";
import { createSocialSession } from "./social-account-repository";

const accountRow = z.object({
  id: z.uuid(),
  account: z.string(),
  user_id: z.uuid(),
  organization_id: z.uuid(),
  password_hash: z.string(),
});
const principalRow = z.object({
  uid: z.string().regex(/^[0-9]{10}$/),
  user_id: z.uuid(),
  organization_id: z.uuid(),
  role: z.enum(["admin", "member"]),
  account: z.string(),
  avatar_preset: z.string().nullable(),
  preferred_locale: z.enum(accountLocales).nullable(),
  nickname: z.string().nullable(),
  social: z.boolean(),
});
export type EnterpriseCredential = z.infer<typeof accountRow>;
export type EnterpriseIdentity = ImagePrincipal & {
  account: string;
  nickname?: string | null;
  loginMethod?: "social";
  avatarPreset?: string | null;
  preferredLocale?: AccountLocale | null;
};
/** 打开企业账号数据访问：登录限流、凭据、会话、身份、改密与个人偏好。 */
export function openAuthRepository(url: string, edge = false) {
  const sql = postgres(url, {
    max: edge ? 1 : 3,
    fetch_types: !edge,
    prepare: true,
    idle_timeout: 20,
    connect_timeout: 10,
    connection: { statement_timeout: 15000, lock_timeout: 5000 },
  });
  const consume = async (key: string, seconds: number, limit: number) => {
    const rows =
      await sql`insert into login_rate_limits (key,window_start,attempts) values (${key},now(),1)
      on conflict (key) do update set
      attempts=case when login_rate_limits.window_start < now()-${seconds}*interval '1 second' then 1 else login_rate_limits.attempts+1 end,
      window_start=case when login_rate_limits.window_start < now()-${seconds}*interval '1 second' then now() else login_rate_limits.window_start end returning attempts`;
    return z.coerce.number().parse(rows[0]?.attempts) <= limit;
  };
  return {
    close: () => sql.end({ timeout: 5 }),
    async allowLogin(account: string) {
      if (!(await consume("global", 60, 200))) return false;
      // 只保存账号标识的哈希；不保存提交的密码或原始请求体。
      const key = createHash("sha256").update(account).digest("hex");
      await sql`delete from login_rate_limits where window_start < now()-interval '1 day'`;
      return consume(key, 900, 10);
    },
    /** 分别限制邮箱和连接来源，共用已有的原子计数表。 */
    async allowEmailCode(email: string, address: string, action: "send" | "verify") {
      const key = (kind: string, value: string) =>
        createHash("sha256").update(`email-code:${action}:${kind}:${value}`).digest("hex");
      // 先限制来源，避免同一连接靠变换邮箱大量创建计数项。
      const sending = action === "send";
      const window = sending ? 3600 : 600;
      if (!(await consume(key("ip", address), window, sending ? 15 : 40))) return false;
      return consume(key("email", email), window, sending ? 5 : 8);
    },
    async credential(account: string): Promise<EnterpriseCredential | null> {
      const rows =
        await sql`select id,account,user_id,organization_id,password_hash from enterprise_accounts where account=${account} and disabled_at is null`;
      return rows[0] ? accountRow.parse(rows[0]) : null;
    },
    async createSession(
      id: string,
      credential: EnterpriseCredential,
      expiresAt: Date,
      refreshTokenHash: string | null = null,
    ) {
      const rows =
        await sql`insert into enterprise_sessions (id,account_id,expires_at,credential_version,refresh_token_hash)
        select ${id},id,${expiresAt},credential_version,${refreshTokenHash} from enterprise_accounts where id=${credential.id} and disabled_at is null and password_hash=${credential.password_hash} returning id`;
      return rows.length === 1;
    },
    async identity(sessionId: string): Promise<EnterpriseIdentity | null> {
      const rows = await sql`select coalesce(a.account,p.email,u.uid) as account,
        u.id as user_id,m.organization_id,m.role,u.uid,u.avatar_preset,u.preferred_locale,u.nickname,
        s.social_account_id is not null as social
        from enterprise_sessions s
        left join enterprise_accounts a on a.id=s.account_id and a.disabled_at is null and a.credential_version=s.credential_version
        left join social_accounts p on p.id=s.social_account_id and p.disabled_at is null and p.credential_version=s.credential_version
        join users u on u.id=coalesce(a.user_id,p.user_id)
        join organization_members m on m.user_id=u.id and m.organization_id=coalesce(a.organization_id,p.organization_id)
        where s.id=${sessionId} and s.revoked_at is null and s.expires_at>now()`;
      if (!rows[0]) return null;
      const row = principalRow.parse(rows[0]);
      return {
        userId: row.user_id,
        uid: row.uid,
        organizationId: row.organization_id,
        role: row.role,
        account: row.account,
        nickname: row.nickname,
        ...(row.social ? { loginMethod: "social" as const } : {}),
        avatarPreset: row.avatar_preset,
        preferredLocale: row.preferred_locale,
      };
    },
    /** 保存用户选择的预设头像；只按服务端解析出的 userId 更新。 */
    async setAvatarPreset(userId: string, avatarPreset: string | null) {
      const rows =
        await sql`update users set avatar_preset=${avatarPreset} where id=${userId} returning id`;
      return rows.length === 1;
    },
    /** 保存当前用户的语言，只更新偏好列，避免覆盖并发保存的头像。 */
    async setPreferredLocale(userId: string, locale: AccountLocale) {
      const rows =
        await sql`update users set preferred_locale=${locale} where id=${userId} returning id`;
      return rows.length === 1;
    },
    /** 保存第三方登录会话，沿用主站的访问和刷新凭据。 */
    /** 保存指定会话用户的站内昵称。 */
    async setNickname(userId: string, nickname: string) {
      const rows = await sql`update users set nickname=${nickname} where id=${userId} returning id`;
      return rows.length === 1;
    },
    createSocialSession: (input: Parameters<typeof createSocialSession>[1]) =>
      createSocialSession(sql, input),
    async rotateRefresh(currentHash: string, nextHash: string) {
      const rows = await sql`update enterprise_sessions s set refresh_token_hash=${nextHash}
        where s.refresh_token_hash=${currentHash} and s.revoked_at is null and s.expires_at>now()
        and (
          exists (select 1 from enterprise_accounts a join organization_members m
            on m.user_id=a.user_id and m.organization_id=a.organization_id
            where a.id=s.account_id and a.disabled_at is null and a.credential_version=s.credential_version)
          or exists (select 1 from social_accounts p join organization_members m
            on m.user_id=p.user_id and m.organization_id=p.organization_id
            where p.id=s.social_account_id and p.disabled_at is null and p.credential_version=s.credential_version)
        )
        returning s.id,s.expires_at`;
      return rows[0]
        ? z.object({ id: z.uuid(), expires_at: z.coerce.date() }).parse(rows[0])
        : null;
    },
    async changePassword(credential: EnterpriseCredential, passwordHash: string) {
      return sql.begin(async (tx) => {
        const rows =
          await tx`update enterprise_accounts set password_hash=${passwordHash},credential_version=gen_random_uuid()
          where id=${credential.id} and password_hash=${credential.password_hash} and disabled_at is null returning id`;
        if (!rows[0]) return false;
        await tx`delete from enterprise_sessions where account_id=${credential.id}`;
        return true;
      });
    },
    async revoke(sessionId: string) {
      await sql`update enterprise_sessions set revoked_at=now() where id=${sessionId} and revoked_at is null`;
    },
    async setCredential(
      account: string,
      userId: string,
      organizationId: string,
      passwordHash: string,
    ) {
      await sql.begin(async (tx) => {
        // 账号不能被悄悄改绑到其他用户或企业。
        const rows =
          await tx`insert into enterprise_accounts (account,user_id,organization_id,password_hash) values (${account},${userId},${organizationId},${passwordHash})
          on conflict (account) do update set password_hash=excluded.password_hash, credential_version=gen_random_uuid(), disabled_at=null
          where enterprise_accounts.user_id=excluded.user_id and enterprise_accounts.organization_id=excluded.organization_id returning id`;
        if (!rows[0]) throw new Error("ACCOUNT_IDENTITY_CONFLICT");
        await tx`delete from enterprise_sessions where account_id=${rows[0].id}`;
      });
    },
  };
}
export type AuthRepository = ReturnType<typeof openAuthRepository>;
