import { z } from "zod";

export const realtimeCursorSchema = z.string().regex(/^(0|[1-9][0-9]{0,18})$/);
/** 单设备登录替换旧连接时的关闭码。 */
export const sessionReplacedCloseCode = 4002;
export const releaseSchema = z.object({
  version: z.string().min(1).max(80),
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(2000),
  publishedAt: z.string().datetime(),
});
export const realtimeEventSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["task", "asset", "wallet", "notification", "release"]),
  resourceId: z.uuid().optional(),
  release: releaseSchema.optional(),
});
export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;
/** 实时投递含内部会话控制消息，会话编号不会进入浏览器可见的事件。 */
export const realtimeOutboxMessageSchema = z.union([
  realtimeEventSchema,
  z.object({ id: z.uuid(), kind: z.literal("session-revoked"), resourceId: z.uuid() }),
]);
export type RealtimeOutboxMessage = z.infer<typeof realtimeOutboxMessageSchema>;
export const realtimeFrameSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("session-revoked") }),
  z.object({ type: z.literal("event"), cursor: realtimeCursorSchema, event: realtimeEventSchema }),
  z.object({
    type: z.literal("ready"),
    cursor: realtimeCursorSchema,
    resync: z.boolean(),
    release: releaseSchema.nullable(),
    expiresAt: z.number(),
  }),
]);
export const notificationSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  body: z.string(),
  createdAt: z.string().datetime(),
  read: z.boolean(),
});
export const notificationListSchema = z.object({
  data: z.array(notificationSchema),
  unread: z.number().int().nonnegative(),
  nextCursor: z.uuid().nullable().default(null),
});

export const releaseResponseSchema = z.object({ release: releaseSchema.nullable() });
