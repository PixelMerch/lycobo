import { createHash, randomBytes } from "node:crypto";
import type { ImageScope } from "@lycoboai/contracts";
import type postgres from "postgres";
import { appendWalletEntry, ensureWallet } from "../wallet/wallet-repository";
import { type ImagePrincipal, ImageRepositoryError } from "./image-repository-types";

async function initializeOrganizationWallet(
  tx: postgres.TransactionSql,
  organizationId: string,
  userId: string,
  credits: number,
) {
  const wallet = await ensureWallet(tx, {
    organizationId: organizationId,
    userId: userId,
  });
  if (credits > 0)
    await appendWalletEntry(tx, wallet.id, {
      eventKey: "provision-opening",
      kind: "opening",
      amount: credits,
      userId: userId,
    });
}

export function imageIdentityRepository(sql: postgres.Sql) {
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  return {
    async storageUid(scope: ImageScope) {
      const [row] =
        await sql`select u.uid from users u join organization_members m on m.user_id=u.id
        where u.id=${scope.userId} and m.organization_id=${scope.organizationId}`;
      if (!row || !/^[0-9]{10}$/.test(String(row.uid))) throw new ImageRepositoryError("FORBIDDEN");
      return String(row.uid);
    },
    async provision(
      subject: string,
      organizationName: string,
      credits: number,
      reuseOrganization = false,
    ) {
      const token = randomBytes(32).toString("base64url");
      return sql.begin(async (tx) => {
        const [user] =
          await tx`insert into users (auth_subject) values (${subject}) on conflict (auth_subject)
          do update set auth_subject=excluded.auth_subject returning id,uid`;
        if (!user) throw new Error("PROVISION_FAILED");
        let org = reuseOrganization
          ? (
              await tx`select o.id from organizations o join organization_members m on m.organization_id=o.id
              where m.user_id=${user.id} and m.role='admin' and o.name=${organizationName} order by o.created_at limit 1`
            )[0]
          : undefined;
        if (!org) {
          [org] =
            await tx`insert into organizations (name,available_credits) values (${organizationName},0) returning id`;
          if (!org) throw new Error("PROVISION_FAILED");
          await tx`insert into organization_members (organization_id,user_id,role) values (${org.id},${user.id},'admin')`;
          await initializeOrganizationWallet(tx, String(org.id), String(user.id), credits);
        }
        const [key] =
          await tx`insert into generation_api_keys (organization_id,user_id,token_hash,expires_at)
          values (${org.id},${user.id},${hash(token)},now()+interval '7 days') returning id`;
        return {
          userId: String(user.id),
          uid: String(user.uid),
          organizationId: String(org.id),
          keyId: String(key?.id),
          token,
        };
      });
    },
    async authenticate(token: string): Promise<ImagePrincipal | null> {
      if (!/^[\w-]{43}$/.test(token)) return null;
      const [row] =
        await sql`select k.user_id,k.organization_id,m.role,u.uid from generation_api_keys k
        join users u on u.id=k.user_id
        join organization_members m on m.organization_id=k.organization_id and m.user_id=k.user_id
        where k.token_hash=${hash(token)} and k.revoked_at is null and k.expires_at>now()`;
      if (!row || (row.role !== "admin" && row.role !== "member")) return null;
      return {
        userId: String(row.user_id),
        organizationId: String(row.organization_id),
        role: row.role,
        uid: String(row.uid),
      };
    },
  };
}
