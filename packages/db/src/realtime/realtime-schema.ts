import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations, users } from "../schema";

/** 业务事务中的可靠投递意图，事件内容不包含提示词、密钥或签名地址。 */
export const realtimeOutbox = pgTable(
  "realtime_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channel: text("channel").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    event: jsonb("event").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  },
  (t) => [
    index("realtime_outbox_pending_idx").on(t.createdAt, t.id).where(sql`${t.deliveredAt} is null`),
  ],
).enableRLS();
/** 已发布的产品更新，部署成功后由发布脚本写入。 */
export const realtimeReleases = pgTable("realtime_releases", {
  version: text("version").primaryKey(),
  payload: jsonb("payload").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
}).enableRLS();
/** 消息持久化与传输独立，离线用户也可以在消息中心读取。 */
export const realtimeNotifications = pgTable(
  "realtime_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("realtime_notifications_org_created_idx").on(t.organizationId, t.createdAt, t.id)],
).enableRLS();
/** 已读记录按用户隔离，共享组织消息不会被其他成员代读。 */
export const realtimeNotificationReads = pgTable(
  "realtime_notification_reads",
  {
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => realtimeNotifications.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.notificationId, t.userId] })],
).enableRLS();
