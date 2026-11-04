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
  primaryKey,
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
export const generationApiKeys = pgTable(
  "generation_api_keys",
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
      name: "generation_api_keys_membership_fk",
    }),
    index("generation_api_keys_member_idx").on(t.organizationId, t.userId),
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
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    cleanupStartedAt: timestamp("cleanup_started_at", { withTimezone: true }),
    storageDeletedAt: timestamp("storage_deleted_at", { withTimezone: true }),
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
    index("media_assets_expiry_idx")
      .on(t.expiresAt)
      .where(sql`${t.expiresAt} is not null and ${t.storageDeletedAt} is null`),
    index("media_assets_member_idx").on(t.organizationId, t.userId),
    check(
      "media_assets_dimensions_check",
      sql`${t.width} > 0 and ${t.height} > 0 and ${t.bytes} > 0`,
    ),
    check("media_assets_kind_check", sql`${t.kind} in ('reference','output')`),
    check("media_assets_media_type_check", sql`${t.mediaType} in ('image','video','audio')`),
  ],
);
export const generationJobs = pgTable(
  "generation_jobs",
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
    providerSnapshot: jsonb("provider_snapshot"),
    prompt: text("prompt").notNull(),
    resolution: text("resolution").notNull(),
    aspectRatio: text("aspect_ratio").notNull(),
    requestedCount: integer("requested_count").notNull(),
    unitCredits: integer("unit_credits").notNull(),
    status: text("status").notNull().default("queued"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    foreignKey({
      columns: [t.organizationId, t.userId],
      foreignColumns: [organizationMembers.organizationId, organizationMembers.userId],
      name: "generation_jobs_membership_fk",
    }),
    unique("generation_jobs_scope_key_unique").on(t.organizationId, t.userId, t.idempotencyKey),
    unique("generation_jobs_id_org_unique").on(t.id, t.organizationId),
    index("generation_jobs_org_created_idx").on(t.organizationId, t.createdAt, t.id),
    index("generation_jobs_member_idx").on(t.organizationId, t.userId),
    check(
      "generation_jobs_count_check",
      sql`${t.requestedCount} between 1 and 20 and ${t.unitCredits} > 0 and (${t.requestedCount} <= 4 or (${t.requestedCount} <= 10 and ${t.input} ? 'textileSet') or ${t.input} ? 'variation')`,
    ),
    check(
      "generation_jobs_status_check",
      sql`${t.status} in ('queued','running','succeeded','partially_failed','failed','needs_reconciliation')`,
    ),
  ],
);
// Submission lineage; full immutable region snapshot lives in generation_jobs.input.localEdit.
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
      foreignColumns: [generationJobs.id, generationJobs.organizationId],
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
/** Personal favorites over the organization's shared assets; one row per member and asset. */
export const imageAssetFavorites = pgTable(
  "image_asset_favorites",
  {
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id").notNull(),
    assetId: uuid("asset_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({
      name: "image_asset_favorites_pk",
      columns: [t.organizationId, t.userId, t.assetId],
    }),
    foreignKey({
      columns: [t.assetId, t.organizationId],
      foreignColumns: [mediaAssets.id, mediaAssets.organizationId],
      name: "image_asset_favorites_asset_org_fk",
    }),
    foreignKey({
      columns: [t.organizationId, t.userId],
      foreignColumns: [organizationMembers.organizationId, organizationMembers.userId],
      name: "image_asset_favorites_member_fk",
    }),
    index("image_asset_favorites_recent_idx").on(
      t.organizationId,
      t.userId,
      t.createdAt.desc(),
      t.assetId.desc(),
    ),
  ],
).enableRLS();
export const generationJobItems = pgTable(
  "generation_job_items",
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
      foreignColumns: [generationJobs.id, generationJobs.organizationId],
      name: "generation_job_items_job_org_fk",
    }),
    foreignKey({
      columns: [t.outputAssetId, t.organizationId],
      foreignColumns: [mediaAssets.id, mediaAssets.organizationId],
      name: "generation_job_items_output_org_fk",
    }),
    uniqueIndex("generation_job_items_current_position_unique")
      .on(t.jobId, t.position)
      .where(sql`${t.supersededAt} is null`),
    index("generation_job_items_output_idx").on(t.outputAssetId, t.organizationId),
    index("generation_job_items_reconciler_idx").on(t.reconciledBy),
    index("generation_job_items_running_started_idx")
      .on(t.startedAt, t.organizationId)
      .where(sql`${t.status} = 'running' and ${t.supersededAt} is null`),
    index("generation_job_items_lease_idx")
      .on(t.leaseExpiresAt)
      .where(sql`${t.status} = 'running'`),
    check(
      "generation_job_items_position_check",
      sql`${t.position} between 0 and 19 and ${t.attempts} >= 0`,
    ),
    check(
      "generation_job_items_status_check",
      sql`${t.status} in ('queued','running','succeeded','failed','needs_reconciliation')`,
    ),
    check(
      "generation_job_items_output_check",
      sql`${t.status} <> 'succeeded' or ${t.outputAssetId} is not null`,
    ),
  ],
);
export const generationOutbox = pgTable(
  "generation_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .unique()
      .references(() => generationJobItems.id),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    leaseToken: uuid("lease_token"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("generation_outbox_due_idx").on(t.nextAttemptAt)],
);
export const generationCreditLedger = pgTable(
  "generation_credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    jobId: uuid("job_id").notNull(),
    itemId: uuid("item_id").references(() => generationJobItems.id),
    eventType: text("event_type").notNull(),
    amount: integer("amount").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.jobId, t.organizationId],
      foreignColumns: [generationJobs.id, generationJobs.organizationId],
      name: "generation_credit_ledger_job_org_fk",
    }),
    uniqueIndex("generation_credit_ledger_refund_unique")
      .on(t.itemId)
      .where(sql`${t.eventType} = 'refund'`),
    uniqueIndex("generation_credit_ledger_reserve_unique")
      .on(t.jobId)
      .where(sql`${t.eventType} = 'reserve'`),
    index("generation_credit_ledger_org_created_idx").on(t.organizationId, t.createdAt),
    index("generation_credit_ledger_job_idx").on(t.jobId, t.organizationId),
    check(
      "generation_credit_ledger_amount_check",
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

export const generationEvents = pgTable(
  "generation_events",
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
    index("generation_events_org_cursor_idx").on(t.organizationId, t.id),
    index("generation_events_created_idx").on(t.createdAt),
    check("generation_events_kind_check", sql`${t.kind} in ('task','asset')`),
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
    jobId: uuid("job_id").references(() => generationJobs.id),
    itemId: uuid("item_id").references(() => generationJobItems.id),
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
      sql`(${t.kind} in ('consume','refund') and ${t.jobId} is not null and ${t.itemId} is not null and ${t.rechargeId} is null) or (${t.kind} in ('consume','refund') and ${t.eventKey} like 'prompt-optimize:%' and ${t.jobId} is null and ${t.itemId} is null and ${t.rechargeId} is null) or (${t.kind} = 'recharge' and ${t.rechargeId} is not null and ${t.jobId} is null and ${t.itemId} is null) or (${t.kind} in ('opening','checkin') and ${t.jobId} is null and ${t.itemId} is null and ${t.rechargeId} is null)`,
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

export const generationRetries = pgTable(
  "generation_retries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    targetItemId: uuid("target_item_id").references(() => generationJobItems.id),
    jobId: uuid("job_id").notNull(),
    key: uuid("idempotency_key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.jobId, t.organizationId],
      foreignColumns: [generationJobs.id, generationJobs.organizationId],
      name: "generation_retries_job_org_fk",
    }),
    unique("generation_retries_scope_key_unique").on(t.organizationId, t.userId, t.key),
    index("generation_retries_job_idx").on(t.jobId, t.organizationId),
    index("generation_retries_user_idx").on(t.userId),
  ],
);

// Platform configuration is separate from enterprise membership and never exposed by the model catalog.
export const platformAdministrators = pgTable("platform_administrators", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id),
  enabled: integer("enabled").notNull().default(1),
  createdAt: createdAt(),
}).enableRLS();
export const modelCredentials = pgTable("model_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  ciphertext: text("ciphertext").notNull(),
  createdAt: createdAt(),
}).enableRLS();
export const modelProviders = pgTable("model_providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  origin: text("origin").notNull(),
  websiteUrl: text("website_url"),
  adapter: text("adapter").notNull(),
  credentialId: uuid("credential_id")
    .notNull()
    .references(() => modelCredentials.id),
  enabled: integer("enabled").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();
export const modelCatalog = pgTable(
  "model_catalog",
  {
    id: uuid("id").notNull().defaultRandom().unique(),
    code: text("code").primaryKey(),
    name: text("name").notNull(),
    logoUrl: text("logo_url"),
    description: text("description").notNull().default(""),
    capabilitySummary: text("capability_summary").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    upstreamModel: text("upstream_model"),
    providerId: uuid("provider_id").references(() => modelProviders.id),
    category: text("category").notNull(),
    enabled: integer("enabled").notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [
    check("model_catalog_category_check", sql`${t.category} in ('image','music','video')`),
    index("model_catalog_provider_idx").on(t.providerId),
  ],
).enableRLS();
export const modelProviderKeys = pgTable(
  "model_provider_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => modelProviders.id),
    credentialId: uuid("credential_id")
      .notNull()
      .references(() => modelCredentials.id),
    name: text("name").notNull(),
    enabled: integer("enabled").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("model_provider_keys_provider_name_unique").on(t.providerId, t.name),
    index("model_provider_keys_credential_idx").on(t.credentialId),
  ],
).enableRLS();
export const modelChannels = pgTable(
  "model_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => modelProviders.id),
    name: text("name").notNull(),
    model: text("model")
      .notNull()
      .references(() => modelCatalog.code),
    keyId: uuid("key_id").references(() => modelProviderKeys.id),
    settings: jsonb("settings").notNull(),
    enabled: integer("enabled").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index("model_channels_provider_idx").on(t.providerId),
    index("model_channels_key_idx").on(t.keyId),
    index("model_channels_model_idx").on(t.model),
  ],
).enableRLS();
export const modelRoutes = pgTable(
  "model_routes",
  {
    tool: text("tool").notNull(),
    model: text("model").notNull(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => modelChannels.id),
  },
  (t) => [
    unique("model_routes_tool_model_unique").on(t.tool, t.model),
    index("model_routes_channel_idx").on(t.channelId),
  ],
).enableRLS();
export const modelAuditEvents = pgTable(
  "model_audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id),
    administratorId: uuid("administrator_id").references(() => adminUsers.id),
    action: text("action").notNull(),
    resourceId: uuid("resource_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("model_audit_created_idx").on(t.createdAt)],
).enableRLS();
export const providerExecutions = pgTable(
  "provider_executions",
  {
    itemId: uuid("item_id")
      .primaryKey()
      .references(() => generationJobItems.id),
    phase: text("phase").notNull(),
    taskId: text("task_id"),
    statusPath: text("status_path"),
    nextPollAt: timestamp("next_poll_at", { withTimezone: true }),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(),
    pollCount: integer("poll_count").notNull().default(0),
    pollFailures: integer("poll_failures").notNull().default(0),
  },
  (t) => [index("provider_executions_due_idx").on(t.nextPollAt)],
).enableRLS();

// Back-office identities have no relationship to business users or enterprise accounts.
export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    account: text("account").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    isSuperAdmin: integer("is_super_admin").notNull().default(0),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [check("admin_users_super_admin_check", sql`${t.isSuperAdmin} in (0,1)`)],
).enableRLS();
export const adminSessions = pgTable(
  "admin_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    administratorId: uuid("administrator_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("admin_sessions_user_idx").on(t.administratorId),
    index("admin_sessions_expiry_idx").on(t.expiresAt),
  ],
).enableRLS();
export const adminLoginLimits = pgTable(
  "admin_login_limits",
  {
    subjectHash: text("subject_hash").primaryKey(),
    attempts: integer("attempts").notNull().default(1),
    resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("admin_login_limits_reset_idx").on(t.resetAt)],
).enableRLS();
export const adminRoles = pgTable("admin_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  permissions: jsonb("permissions").notNull().default(sql`'[]'::jsonb`),
  createdAt: createdAt(),
}).enableRLS();
export const adminUserRoles = pgTable(
  "admin_user_roles",
  {
    administratorId: uuid("administrator_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => adminRoles.id),
  },
  (t) => [
    unique("admin_user_roles_unique").on(t.administratorId, t.roleId),
    index("admin_user_roles_role_idx").on(t.roleId),
  ],
).enableRLS();

// Navigation metadata is independent of Casbin's server-owned permission catalog.
export const adminMenuEntries = pgTable(
  "admin_menu_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id"),
    title: text("title").notNull(),
    type: text("type").notNull(),
    pageId: text("page_id"),
    permission: text("permission").notNull().default(""),
    icon: text("icon").notNull().default("menu"),
    sortOrder: integer("sort_order").notNull().default(0),
    visible: integer("visible").notNull().default(1),
    protected: integer("protected").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({ columns: [t.parentId], foreignColumns: [t.id] }),
    index("admin_menu_parent_order_idx").on(t.parentId, t.sortOrder),
    uniqueIndex("admin_menu_page_unique").on(t.pageId),
    check("admin_menu_type_check", sql`${t.type} in ('directory','menu','button')`),
    check("admin_menu_flags_check", sql`${t.visible} in (0,1) and ${t.protected} in (0,1)`),
    check("admin_menu_parent_check", sql`${t.parentId} is null or ${t.parentId} <> ${t.id}`),
  ],
).enableRLS();

export const variationPlans = pgTable(
  "variation_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id").notNull(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    inputHash: text("input_hash").notNull(),
    input: jsonb("input").notNull(),
    status: text("status").notNull().default("running"),
    items: jsonb("items").notNull().default(sql`'[]'::jsonb`),
    errorCode: text("error_code"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.organizationId, t.userId],
      foreignColumns: [organizationMembers.organizationId, organizationMembers.userId],
    }),
    unique("variation_plan_idempotency").on(t.organizationId, t.userId, t.idempotencyKey),
    index("variation_plan_owner_created").on(t.organizationId, t.userId, t.createdAt),
    check("variation_plan_status", sql`${t.status} in ('running','ready','failed','uncertain')`),
  ],
).enableRLS();
export const modelPlanners = pgTable(
  "model_planners",
  {
    tool: text("tool").primaryKey(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => modelProviders.id),
    origin: text("origin").notNull(),
    protocol: text("protocol").notNull().default("openai-chat"),
    upstreamModel: text("upstream_model").notNull(),
    enabled: integer("enabled").notNull().default(0),
    timeoutMs: integer("timeout_ms").notNull().default(25000),
    createdAt: createdAt(),
  },
  (t) => [
    check("model_planner_protocol", sql`${t.protocol} in ('openai-chat','anthropic-messages')`),
    check("model_planner_enabled", sql`${t.enabled} in (0,1)`),
    check("model_planner_timeout", sql`${t.timeoutMs} between 5000 and 60000`),
  ],
).enableRLS();

// Receipts contain identifiers only, never callback bodies, prompts or download URLs.
export const providerWebhookEvents = pgTable(
  "provider_webhook_events",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    eventId: text("event_id").notNull(),
    taskId: text("task_id").notNull(),
    eventType: text("event_type").notNull(),
    taskStatus: text("task_status").notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("provider_webhook_task_idx").on(t.source, t.taskId),
    index("provider_webhook_created_idx").on(t.createdAt),
  ],
).enableRLS();
export const providerWebhookTasks = pgTable(
  "provider_webhook_tasks",
  {
    itemId: uuid("item_id")
      .primaryKey()
      .references(() => generationJobItems.id),
    source: text("source").notNull(),
    taskId: text("task_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("provider_webhook_source_task_idx").on(t.source, t.taskId)],
).enableRLS();

/** Durable video intent and provider progress; wallet lineage uses the shared task/item. */
export const generationVideoOutbox = pgTable(
  "generation_video_outbox",
  {
    jobId: uuid("job_id")
      .primaryKey()
      .references(() => generationJobs.id),
    itemId: uuid("item_id")
      .notNull()
      .unique()
      .references(() => generationJobItems.id),
    origin: text("origin").notNull(),
    credentialHash: text("credential_hash").notNull(),
    phase: text("phase").notNull().default("queued"),
    providerTaskId: text("provider_task_id"),
    providerStatus: text("provider_status"),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }).notNull().defaultNow(),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    executionToken: uuid("execution_token"),
    failures: integer("failures").notNull().default(0),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [
    index("generation_video_due_idx").on(t.nextRunAt).where(sql`${t.processedAt} is null`),
    check(
      "generation_video_phase_check",
      sql`${t.phase} in ('queued','submitting','polling','downloading','done')`,
    ),
    check("generation_video_failures_check", sql`${t.failures} >= 0`),
  ],
).enableRLS();

export const promptOptimizations = pgTable(
  "prompt_optimizations",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    key: uuid("key").notNull(),
    inputHash: text("input_hash").notNull(),
    status: text("status").notNull().default("running"),
    result: text("result"),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.organizationId, t.userId, t.key] }),
    index("prompt_optimizations_scope_created_idx").on(t.organizationId, t.userId, t.createdAt),
    check(
      "prompt_optimizations_result_check",
      sql`(${t.status} = 'ready' and ${t.result} is not null and char_length(${t.result}) between 1 and 5000) or (${t.status} in ('running','failed') and ${t.result} is null)`,
    ),
  ],
);
