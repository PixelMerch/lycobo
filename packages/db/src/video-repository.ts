import { createHash } from "node:crypto";
import type { ImageScope, VideoCreateInput } from "@lycoboai/contracts";
import postgres from "postgres";
import { z } from "zod";
import { type CloudBaseDatabaseBindings, cloudbaseRpc } from "./cloudbase-rpc";

export const videoCredentialHash = (key: string) => createHash("sha256").update(key).digest("hex");
type VideoOperation =
  | "storageUid"
  | "create"
  | "list"
  | "get"
  | "claim"
  | "due"
  | "defer"
  | "finish";
export type VideoRun = (
  operation: VideoOperation,
  args?: Record<string, unknown>,
) => Promise<unknown>;
export function videoRepository(run: VideoRun, close: () => Promise<void> = async () => {}) {
  return {
    run,
    close,
    create: (
      scope: ImageScope,
      input: VideoCreateInput,
      key: string,
      config: { origin: string; credentialHash: string },
    ) => {
      const { storyboard, storyboardOriginalImageCount, ...video } = input;
      return run("create", {
        organizationId: scope.organizationId,
        userId: scope.userId,
        input: video,
        ...(storyboard ? { storyboard } : {}),
        ...(storyboardOriginalImageCount !== undefined ? { storyboardOriginalImageCount } : {}),
        key,
        ...config,
        inputHash: videoCredentialHash(JSON.stringify(input)),
      }).then((value) => z.object({ id: z.uuid(), replayed: z.boolean() }).parse(value));
    },
    list: (scope: ImageScope, before?: string) =>
      run("list", { organizationId: scope.organizationId, userId: scope.userId, before }),
    get: (scope: ImageScope, id: string) =>
      run("get", { organizationId: scope.organizationId, userId: scope.userId, id }),
  };
}
export type VideoRepository = ReturnType<typeof videoRepository>;
export function openVideoRepository(env: CloudBaseDatabaseBindings & { DATABASE_URL?: string }) {
  if (env.DATABASE_URL && env.CLOUDBASE_ENV_ID) throw new Error("DATABASE_BACKEND_CONFLICT");
  if (env.DATABASE_URL) {
    const sql = postgres(env.DATABASE_URL, {
      max: 2,
      connect_timeout: 10,
      idle_timeout: 20,
      connection: { statement_timeout: 15000, lock_timeout: 5000 },
    });
    return videoRepository(
      async (operation, args = {}) => {
        const [row] =
          await sql`select public.lycobo_video_operation(${operation},${sql.json(z.json().parse(JSON.parse(JSON.stringify(args))))}) as value`;
        return row?.value;
      },
      () => sql.end(),
    );
  }
  const call = cloudbaseRpc(env);
  return videoRepository((p_operation, p_args = {}) =>
    call("lycobo_video_operation", { p_operation, p_args }),
  );
}
