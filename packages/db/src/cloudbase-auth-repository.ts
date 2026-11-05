import { createHash } from "node:crypto";
import { z } from "zod";
import type { AuthRepository } from "./auth-repository";
import { type CloudBaseDatabaseBindings, type CloudBaseRpc, cloudbaseRpc } from "./cloudbase-rpc";

const credentialSchema = z.object({
  id: z.uuid(),
  account: z.string(),
  user_id: z.uuid(),
  organization_id: z.uuid(),
  password_hash: z.string(),
});
const identitySchema = z.object({
  uid: z.string().regex(/^[0-9]{10}$/),
  userId: z.uuid(),
  organizationId: z.uuid(),
  role: z.enum(["admin", "member"]),
  account: z.string(),
});
export function cloudbaseAuthRepository(call: CloudBaseRpc): AuthRepository {
  return {
    close: async () => undefined,
    async allowLogin(account) {
      return z.boolean().parse(
        await call("lycobo_auth_allow_login", {
          p_account_key: createHash("sha256").update(account).digest("hex"),
        }),
      );
    },
    async credential(account) {
      return credentialSchema
        .nullable()
        .parse(await call("lycobo_auth_credential", { p_account: account }));
    },
    async createSession(id, credential, expiresAt, refreshTokenHash = null) {
      return z.boolean().parse(
        await call("lycobo_auth_create_session", {
          p_id: id,
          p_account_id: credential.id,
          p_password_hash: credential.password_hash,
          p_expires_at: expiresAt.toISOString(),
          p_refresh_hash: refreshTokenHash,
        }),
      );
    },
    async identity(sessionId) {
      return identitySchema
        .nullable()
        .parse(await call("lycobo_auth_identity", { p_session_id: sessionId }));
    },
    async rotateRefresh(currentHash, nextHash) {
      return z
        .object({ id: z.uuid(), expires_at: z.coerce.date() })
        .nullable()
        .parse(
          await call("lycobo_auth_rotate_refresh", {
            p_current_hash: currentHash,
            p_next_hash: nextHash,
          }),
        );
    },
    async changePassword(credential, passwordHash) {
      return z.boolean().parse(
        await call("lycobo_auth_change_password", {
          p_account_id: credential.id,
          p_current_hash: credential.password_hash,
          p_password_hash: passwordHash,
        }),
      );
    },
    async revoke(sessionId) {
      z.boolean().parse(await call("lycobo_auth_revoke", { p_session_id: sessionId }));
    },
    async setCredential(account, userId, organizationId, passwordHash) {
      z.boolean().parse(
        await call("lycobo_auth_set_credential", {
          p_account: account,
          p_user_id: userId,
          p_organization_id: organizationId,
          p_password_hash: passwordHash,
        }),
      );
    },
  };
}
export function openCloudBaseAuthRepository(
  env: CloudBaseDatabaseBindings,
  request: typeof fetch = fetch,
) {
  return cloudbaseAuthRepository(cloudbaseRpc(env, request));
}
