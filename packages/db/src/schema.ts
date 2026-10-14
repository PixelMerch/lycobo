import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
export const taskStatus = pgEnum("task_status", [
  "queued",
  "running",
  "succeeded",
  "partially_failed",
  "failed",
  "cancelled",
]);
export const itemStatus = pgEnum("item_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  authSubject: text("auth_subject").notNull().unique(),
  createdAt: createdAt(),
});
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    sku: text("sku"),
    canvas: jsonb("canvas").$type<Record<string, unknown>>().notNull().default({}),
    canvasVersion: integer("canvas_version").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("projects_owner_created_idx").on(t.ownerId, t.createdAt),
    unique("projects_id_owner_unique").on(t.id, t.ownerId),
  ],
);
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id),
    projectId: uuid("project_id").notNull(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    inputHash: text("input_hash").notNull(),
    input: jsonb("input").$type<Record<string, unknown>>().notNull(),
    status: taskStatus("status").notNull().default("queued"),
    requestedCount: integer("requested_count").notNull(),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.projectId, t.ownerId],
      foreignColumns: [projects.id, projects.ownerId],
      name: "tasks_project_owner_fk",
    }),
    uniqueIndex("tasks_owner_idempotency_idx").on(t.ownerId, t.idempotencyKey),
    unique("tasks_id_owner_unique").on(t.id, t.ownerId),
    index("tasks_owner_created_idx").on(t.ownerId, t.createdAt),
    index("tasks_project_owner_idx").on(t.projectId, t.ownerId),
    check("tasks_count_check", sql`${t.requestedCount} between 1 and 4`),
  ],
);
export const taskItems = pgTable(
  "task_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id),
    position: integer("position").notNull(),
    status: itemStatus("status").notNull().default("queued"),
    provider: text("provider"),
    providerTaskId: text("provider_task_id"),
    outputObjectKey: text("output_object_key"),
    errorCode: text("error_code"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    unique("task_items_task_position_unique").on(t.taskId, t.position),
    index("task_items_provider_task_idx").on(t.provider, t.providerTaskId),
    check("task_items_position_check", sql`${t.position} between 0 and 3`),
    check("task_items_attempts_check", sql`${t.attempts} >= 0`),
    check(
      "task_items_success_output_check",
      sql`${t.status} <> 'succeeded' or ${t.outputObjectKey} is not null`,
    ),
  ],
);
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id),
    taskId: uuid("task_id").notNull(),
    eventKey: text("event_key").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.taskId, t.ownerId],
      foreignColumns: [tasks.id, tasks.ownerId],
      name: "notifications_task_owner_fk",
    }),
    uniqueIndex("notifications_owner_event_idx").on(t.ownerId, t.eventKey),
    index("notifications_owner_created_idx").on(t.ownerId, t.createdAt),
    index("notifications_task_owner_idx").on(t.taskId, t.ownerId),
  ],
);
export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
  },
  (t) => [
    index("outbox_pending_idx").on(t.createdAt).where(sql`${t.dispatchedAt} is null`),
    index("outbox_task_idx").on(t.taskId),
  ],
);
