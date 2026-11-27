import { createHash, randomBytes } from "node:crypto";
import {
  type ImageScope,
  imageAutomationKeyPrefix,
  imageAutomationKeyStatusSchema,
  imageJobSchema,
} from "@lycoboai/contracts";
import type postgres from "postgres";
import { z } from "zod";
import type { ImagePrincipal } from "./image-repository-types";

const namespace = "automation:";
const principal = z.object({
  userId: z.uuid(),
  organizationId: z.uuid(),
  role: z.enum(["admin", "member"]),
  uid: z.string(),
});
const ownTask = z.object({
  id: z.uuid(),
  publicId: imageJobSchema.shape.public_id.unwrap(),
  aspectRatio: imageJobSchema.shape.aspect_ratio,
  status: imageJobSchema.shape.status,
  asset_ids: z.array(z.uuid()),
});

function automationHash(token: string) {
  // 用独立前缀隔开自动化与旧服务 Key 的存储查询及权限。
  return namespace + createHash("sha256").update(token).digest("hex");
}

/** 限定企业成员只能管理个人 Key，并将密文和摘要原子写入。 */
export function imageAutomationRepository(sql: postgres.Sql) {
  const ownedKey = (tx: postgres.Sql | postgres.TransactionSql, scope: ImageScope) => tx`
    k.organization_id=${scope.organizationId} and k.user_id=${scope.userId}
    and starts_with(k.token_hash,${namespace})`;
  const enterpriseMember = (tx: postgres.Sql | postgres.TransactionSql) => tx`exists (
    select 1 from enterprise_accounts a where a.user_id=m.user_id
    and a.organization_id=m.organization_id and a.disabled_at is null)`;
  return {
    async status(scope: ImageScope) {
      const [row] =
        await sql`select k.expires_at,k.key_suffix,k.key_ciphertext is not null as copyable from organization_members m
        left join generation_api_keys k on ${ownedKey(sql, scope)}
          and k.revoked_at is null and k.expires_at>now()
        where m.organization_id=${scope.organizationId} and m.user_id=${scope.userId}
          and ${enterpriseMember(sql)}`;
      return row
        ? imageAutomationKeyStatusSchema.parse({
            expiresAt: z.date().nullable().parse(row.expires_at)?.toISOString() ?? null,
            ...(row.key_suffix === null ? {} : { lastFour: row.key_suffix }),
            ...(row.copyable ? { copyable: true } : {}),
          })
        : null;
    },
    async keyCiphertext(scope: ImageScope) {
      const [row] = await sql`select k.key_ciphertext from organization_members m
        join generation_api_keys k on ${ownedKey(sql, scope)}
          and k.revoked_at is null and k.expires_at>now()
        where m.organization_id=${scope.organizationId} and m.user_id=${scope.userId}
          and ${enterpriseMember(sql)}`;
      return row ? z.string().nullable().parse(row.key_ciphertext) : null;
    },
    async rotate(scope: ImageScope, seal: (key: string) => Promise<string>) {
      const key = imageAutomationKeyPrefix + randomBytes(32).toString("base64url");
      const ciphertext = await seal(key);
      return sql.begin(async (tx) => {
        // 锁定成员行，避免同一账号并发签发多把有效的自动化 Key。
        const [member] = await tx`select 1 from organization_members m
          where m.organization_id=${scope.organizationId} and m.user_id=${scope.userId}
            and ${enterpriseMember(tx)} for no key update`;
        if (!member) return null;
        const hash = automationHash(key);
        // 末四位只用于区分遮罩，鉴权继续验证完整 Key 的摘要。
        const suffix = key.slice(-4);
        const [existing] = await tx`update generation_api_keys k
          set token_hash=${hash},key_suffix=${suffix},key_ciphertext=${ciphertext},expires_at=now()+interval '90 days',revoked_at=null
          where ${ownedKey(tx, scope)} returning expires_at`;
        const [record] = existing
          ? [existing]
          : await tx`insert into generation_api_keys
          (organization_id,user_id,token_hash,key_suffix,key_ciphertext,expires_at)
          values (${scope.organizationId},${scope.userId},${hash},${suffix},${ciphertext},now()+interval '90 days')
          returning expires_at`;
        return { key, expiresAt: z.date().parse(record?.expires_at).toISOString() };
      });
    },
    async revoke(scope: ImageScope) {
      // 与签发采用同一个成员锁，撤销始终作用在当前的 Key 上。
      return sql.begin(async (tx) => {
        const [member] = await tx`select 1 from organization_members m
          where m.organization_id=${scope.organizationId} and m.user_id=${scope.userId}
            and ${enterpriseMember(tx)} for no key update`;
        if (!member) return false;
        await tx`update generation_api_keys k set revoked_at=now(),key_ciphertext=null
          where ${ownedKey(tx, scope)} and k.revoked_at is null`;
        return true;
      });
    },
    async authenticate(token: string): Promise<ImagePrincipal | null> {
      if (!/^lcb_img_[\w-]{43}$/.test(token)) return null;
      const [row] = await sql`select k.organization_id as "organizationId",k.user_id as "userId",
        m.role,u.uid from generation_api_keys k join organization_members m
        on m.organization_id=k.organization_id and m.user_id=k.user_id
        join users u on u.id=k.user_id
        where k.token_hash=${automationHash(token)} and k.revoked_at is null and k.expires_at>now()
          and ${enterpriseMember(sql)}`;
      return principal.safeParse(row).data ?? null;
    },
    async result(scope: ImageScope, taskId: string) {
      // 自动化 Key 只能读取自己的结果，状态查询不代替队列恢复作业。
      const match = z.uuid().safeParse(taskId).success
        ? sql`j.id=${taskId}`
        : sql`j.public_id=${taskId}`;
      const [row] =
        await sql`select j.id,j.public_id as "publicId",j.aspect_ratio as "aspectRatio",j.status,
        to_json(array(select i.output_asset_id from generation_job_items i where i.job_id=j.id
          and i.superseded_at is null and i.output_asset_id is not null order by i.position)) as asset_ids
        from generation_jobs j where ${match} and j.organization_id=${scope.organizationId}
          and j.user_id=${scope.userId} and j.archived_at is null and not (j.input ? 'video')`;
      return row ? ownTask.parse(row) : null;
    },
  };
}
