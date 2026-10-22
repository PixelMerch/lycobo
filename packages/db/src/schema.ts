import { sql } from "drizzle-orm";
import {
  bigint,
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
export const publicIdentifiers = pgTable("public_identifiers", {
  value: text("value").primaryKey(),
  createdAt: createdAt(),
});
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  uid: text("uid")
    .notNull()
    .unique()
    .references(() => publicIdentifiers.value)
    .default(sql`public.allocate_public_identifier('user')`),
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

// Image API tables are additive; existing project/task contracts remain unchanged.
export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    availableCredits: integer("available_credits").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [check("organizations_credits_nonnegative", sql`${t.availableCredits} >= 0`)],
);
export const organizationMembers = pgTable(
  "organization_members",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").notNull().default("member"),
    createdAt: createdAt(),
  },
  (t) => [
    unique("organization_members_org_user_unique").on(t.organizationId, t.userId),
    index("organization_members_user_idx").on(t.userId),
    check("organization_members_role_check", sql`${t.role} in ('admin','member')`),
  ],
);
export const imageApiKeys = pgTable(
  "image_api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.organizationId, t.userId],
      foreignColumns: [organizationMembers.organizationId, organizationMembers.userId],
      name: "image_keys_membership_fk",
    }),
    index("image_keys_member_idx").on(t.organizationId, t.userId),
  ],
);
export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    displayNumber: bigint("display_number", { mode: "bigint" })
      .generatedAlwaysAsIdentity({
        startWith: 100000000,
        minValue: 100000000,
        maxValue: "9223372036854775807",
        cycle: false,
      })
      .unique(),
    publicId: text("public_id")
      .notNull()
      .unique()
      .references(() => publicIdentifiers.value)
      .default(sql`public.allocate_public_identifier('image')`),
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id").notNull(),
    kind: text("kind").notNull(),
    mediaType: text("media_type").notNull().default("image"),
    objectKey: text("object_key").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    bytes: integer("bytes").notNull(),
    sha256: text("sha256").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.organizationId, t.userId],
      foreignColumns: [organizationMembers.organizationId, organizationMembers.userId],
      name: "media_assets_membership_fk",
    }),
    unique("media_assets_id_org_unique").on(t.id, t.organizationId),
    index("media_assets_org_created_idx").on(t.organizationId, t.createdAt),
    index("media_assets_member_idx").on(t.organizationId, t.userId),
    check(
      "media_assets_dimensions_check",
      sql`${t.width} > 0 and ${t.height} > 0 and ${t.bytes} > 0`,
    ),
    check("media_assets_kind_check", sql`${t.kind} in ('reference','output')`),
    check("media_assets_media_type_check", sql`${t.mediaType} in ('image','video','audio')`),
  ],
);
export const imageJobs = pgTable(
  "image_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    displayNumber: bigint("display_number", { mode: "bigint" })
      .generatedAlwaysAsIdentity({
        startWith: 1000000000,
        minValue: 1000000000,
        maxValue: "9223372036854775807",
        cycle: false,
      })
      .unique(),
    publicId: text("public_id")
      .notNull()
      .unique()
      .references(() => publicIdentifiers.value)
      .default(sql`public.allocate_public_identifier('task')`),
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id").notNull(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    inputHash: text("input_hash").notNull(),
    input: jsonb("input").$type<Record<string, unknown>>().notNull(),
    model: text("model").notNull(),
    providerModel: text("provider_model"),
    prompt: text("prompt").notNull(),
    resolution: text("resolution").notNull(),
    aspectRatio: text("aspect_ratio").notNull(),
    requestedCount: integer("requested_count").notNull(),
    unitCredits: integer("unit_credits").notNull(),
    status: text("status").notNull().default("queued"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    foreignKey({
      columns: [t.organizationId, t.userId],
      foreignColumns: [organizationMembers.organizationId, organizationMembers.userId],
      name: "image_jobs_membership_fk",
    }),
    unique("image_jobs_scope_key_unique").on(t.organizationId, t.userId, t.idempotencyKey),
    unique("image_jobs_id_org_unique").on(t.id, t.organizationId),
    index("image_jobs_org_created_idx").on(t.organizationId, t.createdAt, t.id),
    index("image_jobs_member_idx").on(t.organizationId, t.userId),
    check(
      "image_jobs_count_check",
      sql`${t.requestedCount} between 1 and 4 and ${t.unitCredits} > 0`,
    ),
    check(
      "image_jobs_status_check",
      sql`${t.status} in ('queued','running','succeeded','partially_failed','failed','needs_reconciliation')`,
    ),
  ],
);
// Submission lineage; full immutable region snapshot lives in image_jobs.input.localEdit.
export const imageLocalEdits = pgTable(
  "image_local_edits",
  {
    jobId: uuid("job_id").primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id").notNull(),
    sourceAssetId: uuid("source_asset_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.jobId, t.organizationId],
      foreignColumns: [imageJobs.id, imageJobs.organizationId],
      name: "image_local_edits_job_org_fk",
    }),
    foreignKey({
      columns: [t.sourceAssetId, t.organizationId],
      foreignColumns: [mediaAssets.id, mediaAssets.organizationId],
      name: "image_local_edits_source_org_fk",
    }),
    foreignKey({
      columns: [t.organizationId, t.userId],
      foreignColumns: [organizationMembers.organizationId, organizationMembers.userId],
      name: "image_local_edits_member_fk",
    }),
    index("image_local_edits_latest_idx").on(
      t.organizationId,
      t.userId,
      t.sourceAssetId,
      t.createdAt.desc(),
      t.jobId.desc(),
    ),
  ],
);
export const imageJobItems = pgTable(
  "image_job_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id").notNull(),
    organizationId: uuid("organization_id").notNull(),
    position: integer("position").notNull(),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    status: text("status").notNull().default("queued"),
    workerId: text("worker_id"),
    executionToken: uuid("execution_token"),
    provider: text("provider").notNull().default("vakv"),
    providerRequestId: text("provider_request_id"),
    attempts: integer("attempts").notNull().default(0),
    outputAssetId: uuid("output_asset_id"),
    errorCode: text("error_code"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    reconciledBy: uuid("reconciled_by").references(() => users.id),
    reconciliationEvidence: text("reconciliation_evidence"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.jobId, t.organizationId],
      foreignColumns: [imageJobs.id, imageJobs.organizationId],
      name: "image_items_job_org_fk",
    }),
    foreignKey({
      columns: [t.outputAssetId, t.organizationId],
      foreignColumns: [mediaAssets.id, mediaAssets.organizationId],
      name: "image_items_output_org_fk",
    }),
    uniqueIndex("image_items_current_position_unique")
      .on(t.jobId, t.position)
      .where(sql`${t.supersededAt} is null`),
    index("image_items_output_idx").on(t.outputAssetId, t.organizationId),
    index("image_items_reconciler_idx").on(t.reconciledBy),
    index("image_items_lease_idx").on(t.leaseExpiresAt).where(sql`${t.status} = 'running'`),
    check("image_items_position_check", sql`${t.position} between 0 and 3 and ${t.attempts} >= 0`),
    check(
      "image_items_status_check",
      sql`${t.status} in ('queued','running','succeeded','failed','needs_reconciliation')`,
    ),
    check(
      "image_items_output_check",
      sql`${t.status} <> 'succeeded' or ${t.outputAssetId} is not null`,
    ),
  ],
);
export const imageOutbox = pgTable(
  "image_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .unique()
      .references(() => imageJobItems.id),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    leaseToken: uuid("lease_token"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("image_outbox_due_idx").on(t.nextAttemptAt)],
);
export const imageCreditLedger = pgTable(
  "image_credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    jobId: uuid("job_id").notNull(),
    itemId: uuid("item_id").references(() => imageJobItems.id),
    eventType: text("event_type").notNull(),
    amount: integer("amount").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.jobId, t.organizationId],
      foreignColumns: [imageJobs.id, imageJobs.organizationId],
      name: "image_ledger_job_org_fk",
    }),
    uniqueIndex("image_ledger_refund_unique").on(t.itemId).where(sql`${t.eventType} = 'refund'`),
    uniqueIndex("image_ledger_reserve_unique").on(t.jobId).where(sql`${t.eventType} = 'reserve'`),
    index("image_ledger_org_created_idx").on(t.organizationId, t.createdAt),
    index("image_ledger_job_idx").on(t.jobId, t.organizationId),
    check(
      "image_ledger_amount_check",
      sql`(${t.eventType} = 'reserve' and ${t.amount} < 0) or (${t.eventType} = 'refund' and ${t.amount} > 0)`,
    ),
  ],
);

export const enterpriseAccounts = pgTable(
  "enterprise_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    account: text("account").notNull().unique(),
    userId: uuid("user_id").notNull(),
    organizationId: uuid("organization_id").notNull(),
    passwordHash: text("password_hash").notNull(),
    credentialVersion: uuid("credential_version").notNull().defaultRandom(),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.organizationId, t.userId],
      foreignColumns: [organizationMembers.organizationId, organizationMembers.userId],
      name: "enterprise_account_member_fk",
    }).onDelete("cascade"),
    index("enterprise_accounts_member_idx").on(t.organizationId, t.userId),
    check(
      "enterprise_account_normalized",
      sql`${t.account} = lower(trim(${t.account})) and length(${t.account}) between 3 and 128`,
    ),
  ],
);
export const enterpriseSessions = pgTable(
  "enterprise_sessions",
  {
    id: uuid("id").primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => enterpriseAccounts.id, { onDelete: "cascade" }),
    credentialVersion: uuid("credential_version").notNull(),
    refreshTokenHash: text("refresh_token_hash").unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("enterprise_sessions_account_idx").on(t.accountId),
    index("enterprise_sessions_expiry_idx").on(t.expiresAt),
  ],
);
export const loginRateLimits = pgTable(
  "login_rate_limits",
  {
    key: text("key").primaryKey(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull(),
  },
  (t) => [
    index("login_rate_limits_window_idx").on(t.windowStart),
    check("login_rate_limits_attempts_check", sql`${t.attempts} > 0`),
  ],
);

export const imageEvents = pgTable(
  "image_events",
  {
    id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    resourceId: uuid("resource_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("image_events_org_cursor_idx").on(t.organizationId, t.id),
    index("image_events_created_idx").on(t.createdAt),
    check("image_events_kind_check", sql`${t.kind} in ('task','asset')`),
  ],
);

// One shared wallet per enterprise; entries identify the member who initiated each operation.
export const organizationWallets = pgTable(
  "organization_wallets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .unique()
      .references(() => organizations.id),
    balance: integer("balance").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("wallet_balance_check", sql`${t.balance} >= 0`)],
);
export const rechargeOrders = pgTable(
  "recharge_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => organizationWallets.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    idempotencyKey: uuid("idempotency_key").notNull(),
    credits: integer("credits").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("CNY"),
    status: text("status").notNull().default("pending"),
    channel: text("channel").notNull(),
    providerTransactionId: text("provider_transaction_id"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("recharge_user_idx").on(t.userId),
    unique("recharge_wallet_key_unique").on(t.walletId, t.idempotencyKey),
    unique("recharge_provider_unique").on(t.channel, t.providerTransactionId),
    index("recharge_wallet_created_idx").on(t.walletId, t.createdAt, t.id),
    check(
      "recharge_amount_check",
      sql`${t.credits} > 0 and ${t.amountMinor} > 0 and ${t.currency} = 'CNY'`,
    ),
    check("recharge_status_check", sql`${t.status} in ('pending','paid','closed')`),
    check(
      "recharge_paid_check",
      sql`(${t.status} = 'paid') = (${t.paidAt} is not null and ${t.providerTransactionId} is not null)`,
    ),
  ],
);
export const walletEntries = pgTable(
  "wallet_entries",
  {
    id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => organizationWallets.id),
    userId: uuid("user_id").references(() => users.id),
    eventKey: text("event_key").notNull(),
    kind: text("kind").notNull(),
    amount: integer("amount").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    jobId: uuid("job_id").references(() => imageJobs.id),
    itemId: uuid("item_id").references(() => imageJobItems.id),
    rechargeId: uuid("recharge_id").references(() => rechargeOrders.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("wallet_entries_user_idx").on(t.userId),
    unique("wallet_event_unique").on(t.walletId, t.eventKey),
    index("wallet_entries_cursor_idx").on(t.walletId, t.id),
    index("wallet_entries_job_idx").on(t.jobId),
    uniqueIndex("wallet_entries_item_kind_unique").on(t.itemId, t.kind),
    uniqueIndex("wallet_entries_recharge_unique").on(t.rechargeId),
    check(
      "wallet_entry_amount_check",
      sql`${t.balanceAfter} >= 0 and ((${t.kind} = 'consume' and ${t.amount} < 0) or (${t.kind} in ('opening','recharge','refund','checkin') and ${t.amount} > 0))`,
    ),
    check(
      "wallet_entry_source_check",
      sql`(${t.kind} in ('consume','refund') and ${t.jobId} is not null and ${t.itemId} is not null and ${t.rechargeId} is null) or (${t.kind} = 'recharge' and ${t.rechargeId} is not null and ${t.jobId} is null and ${t.itemId} is null) or (${t.kind} in ('opening','checkin') and ${t.jobId} is null and ${t.itemId} is null and ${t.rechargeId} is null)`,
    ),
  ],
);
// Reserved only: no public check-in endpoint or automatic reward until rules are approved.
export const walletCheckins = pgTable(
  "wallet_checkins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => organizationWallets.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    businessDate: text("business_date").notNull(),
    ruleVersion: text("rule_version").notNull(),
    credits: integer("credits").notNull(),
    ledgerId: bigint("ledger_id", { mode: "bigint" })
      .notNull()
      .unique()
      .references(() => walletEntries.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("wallet_checkin_user_idx").on(t.userId),
    unique("wallet_checkin_day_unique").on(t.walletId, t.businessDate),
    check("wallet_checkin_credits_check", sql`${t.credits} > 0`),
    check("wallet_checkin_date_check", sql`${t.businessDate} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`),
  ],
);

export const imageRetries = pgTable(
  "image_retries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    jobId: uuid("job_id").notNull(),
    key: uuid("idempotency_key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.jobId, t.organizationId],
      foreignColumns: [imageJobs.id, imageJobs.organizationId],
      name: "image_retries_job_org_fk",
    }),
    unique("image_retries_scope_key_unique").on(t.organizationId, t.userId, t.key),
    index("image_retries_job_idx").on(t.jobId, t.organizationId),
    index("image_retries_user_idx").on(t.userId),
  ],
);
