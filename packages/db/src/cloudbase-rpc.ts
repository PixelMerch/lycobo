import { z } from "zod";

export interface CloudBaseDatabaseBindings {
  CLOUDBASE_ENV_ID?: string;
  CLOUDBASE_APIKEY?: string;
}
const configSchema = z.object({
  CLOUDBASE_ENV_ID: z.string().regex(/^[a-z0-9][a-z0-9-]{5,99}$/),
  CLOUDBASE_APIKEY: z.string().min(1).max(8192),
});
export function readCloudBaseDatabaseConfig(env: CloudBaseDatabaseBindings) {
  if (!env.CLOUDBASE_ENV_ID && !env.CLOUDBASE_APIKEY) return null;
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) throw new Error("CLOUDBASE_DATABASE_NOT_CONFIGURED");
  return parsed.data;
}
export type CloudBaseOperation =
  | "lycobo_video_operation"
  | "lycobo_image_operation"
  | "lycobo_provider_webhook"
  | "lycobo_image_batch"
  | "lycobo_auth_allow_login"
  | "lycobo_auth_credential"
  | "lycobo_auth_create_session"
  | "lycobo_auth_identity"
  | "lycobo_auth_rotate_refresh"
  | "lycobo_auth_change_password"
  | "lycobo_auth_revoke"
  | "lycobo_auth_set_credential";

const businessErrors = new Set([
  "FORBIDDEN",
  "NOT_FOUND",
  "STATE_CONFLICT",
  "IDEMPOTENCY_CONFLICT",
  "REFERENCE_NOT_FOUND",
  "INSUFFICIENT_CREDITS",
  "MODEL_CAPABILITY_UNVERIFIED",
  "RATE_LIMITED",
  "ACCOUNT_IDENTITY_CONFLICT",
]);
export class CloudBaseOperationError extends Error {}

/** Server data plane only. Ambiguous writes are never automatically retried. */
export function cloudbaseRpc(env: CloudBaseDatabaseBindings, request: typeof fetch = fetch) {
  const config = readCloudBaseDatabaseConfig(env);
  if (!config) throw new Error("CLOUDBASE_DATABASE_NOT_CONFIGURED");
  return async (
    operation: CloudBaseOperation,
    parameters: Record<string, unknown>,
  ): Promise<unknown> => {
    try {
      const response = await request(
        `https://${config.CLOUDBASE_ENV_ID}.api.tcloudbasegateway.com/v1/rdb/rest/rpc/${operation}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.CLOUDBASE_APIKEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(parameters),
          redirect: "manual",
          signal: AbortSignal.timeout(20000),
        },
      );
      if (!response.ok) {
        const error = z.object({ message: z.string() }).safeParse(await response.json());
        if (error.success && businessErrors.has(error.data.message))
          throw new CloudBaseOperationError(error.data.message);
        throw new Error("DATABASE_UNAVAILABLE");
      }
      return await response.json();
    } catch (error) {
      if (error instanceof CloudBaseOperationError) throw error;
      // Never propagate gateway bodies, credentials or sensitive SQL parameters.
      throw new Error("DATABASE_UNAVAILABLE");
    }
  };
}
export type CloudBaseRpc = ReturnType<typeof cloudbaseRpc>;
