-- Coordinated writer upgrade required: legacy views do not support targeted ON CONFLICT.
-- Rename existing relations in place; never copy or recreate task/ledger data.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
SET LOCAL statement_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "public"."image_api_keys" RENAME TO "generation_api_keys";
--> statement-breakpoint
ALTER TABLE "public"."image_credit_ledger" RENAME TO "generation_credit_ledger";
--> statement-breakpoint
ALTER TABLE "public"."image_job_items" RENAME TO "generation_job_items";
--> statement-breakpoint
ALTER TABLE "public"."image_jobs" RENAME TO "generation_jobs";
--> statement-breakpoint
ALTER TABLE "public"."image_outbox" RENAME TO "generation_outbox";
--> statement-breakpoint
ALTER TABLE "public"."image_events" RENAME TO "generation_events";
--> statement-breakpoint
ALTER TABLE "public"."image_retries" RENAME TO "generation_retries";
--> statement-breakpoint
ALTER TABLE "public"."generation_api_keys" RENAME CONSTRAINT "image_keys_membership_fk" TO "generation_api_keys_membership_fk";
--> statement-breakpoint
ALTER TABLE "public"."generation_api_keys" RENAME CONSTRAINT "image_api_keys_token_hash_unique" TO "generation_api_keys_token_hash_unique";
--> statement-breakpoint
ALTER TABLE "public"."generation_api_keys" RENAME CONSTRAINT "image_api_keys_pkey" TO "generation_api_keys_pkey";
--> statement-breakpoint
ALTER INDEX "public"."image_keys_member_idx" RENAME TO "generation_api_keys_member_idx";
--> statement-breakpoint
ALTER TABLE "public"."generation_credit_ledger" RENAME CONSTRAINT "image_credit_ledger_organization_id_organizations_id_fk" TO "generation_credit_ledger_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "public"."generation_credit_ledger" RENAME CONSTRAINT "image_credit_ledger_item_id_image_job_items_id_fk" TO "generation_credit_ledger_item_id_generation_job_items_id_fk";
--> statement-breakpoint
ALTER TABLE "public"."generation_credit_ledger" RENAME CONSTRAINT "image_ledger_job_org_fk" TO "generation_credit_ledger_job_org_fk";
--> statement-breakpoint
ALTER TABLE "public"."generation_credit_ledger" RENAME CONSTRAINT "image_ledger_amount_check" TO "generation_credit_ledger_amount_check";
--> statement-breakpoint
ALTER TABLE "public"."generation_credit_ledger" RENAME CONSTRAINT "image_credit_ledger_pkey" TO "generation_credit_ledger_pkey";
--> statement-breakpoint
ALTER INDEX "public"."image_ledger_refund_unique" RENAME TO "generation_credit_ledger_refund_unique";
--> statement-breakpoint
ALTER INDEX "public"."image_ledger_reserve_unique" RENAME TO "generation_credit_ledger_reserve_unique";
--> statement-breakpoint
ALTER INDEX "public"."image_ledger_org_created_idx" RENAME TO "generation_credit_ledger_org_created_idx";
--> statement-breakpoint
ALTER INDEX "public"."image_ledger_job_idx" RENAME TO "generation_credit_ledger_job_idx";
--> statement-breakpoint
ALTER TABLE "public"."generation_events" RENAME CONSTRAINT "image_events_organization_id_organizations_id_fk" TO "generation_events_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "public"."generation_events" RENAME CONSTRAINT "image_events_kind_check" TO "generation_events_kind_check";
--> statement-breakpoint
ALTER TABLE "public"."generation_events" RENAME CONSTRAINT "image_events_pkey" TO "generation_events_pkey";
--> statement-breakpoint
ALTER INDEX "public"."image_events_org_cursor_idx" RENAME TO "generation_events_org_cursor_idx";
--> statement-breakpoint
ALTER INDEX "public"."image_events_created_idx" RENAME TO "generation_events_created_idx";
--> statement-breakpoint
ALTER SEQUENCE "public"."image_events_id_seq" RENAME TO "generation_events_id_seq";
--> statement-breakpoint
ALTER TABLE "public"."generation_job_items" RENAME CONSTRAINT "image_job_items_reconciled_by_users_id_fk" TO "generation_job_items_reconciled_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "public"."generation_job_items" RENAME CONSTRAINT "image_items_job_org_fk" TO "generation_job_items_job_org_fk";
--> statement-breakpoint
ALTER TABLE "public"."generation_job_items" RENAME CONSTRAINT "image_items_output_org_fk" TO "generation_job_items_output_org_fk";
--> statement-breakpoint
ALTER TABLE "public"."generation_job_items" RENAME CONSTRAINT "image_items_position_check" TO "generation_job_items_position_check";
--> statement-breakpoint
ALTER TABLE "public"."generation_job_items" RENAME CONSTRAINT "image_items_status_check" TO "generation_job_items_status_check";
--> statement-breakpoint
ALTER TABLE "public"."generation_job_items" RENAME CONSTRAINT "image_items_output_check" TO "generation_job_items_output_check";
--> statement-breakpoint
ALTER TABLE "public"."generation_job_items" RENAME CONSTRAINT "image_job_items_pkey" TO "generation_job_items_pkey";
--> statement-breakpoint
ALTER INDEX "public"."image_items_current_position_unique" RENAME TO "generation_job_items_current_position_unique";
--> statement-breakpoint
ALTER INDEX "public"."image_items_output_idx" RENAME TO "generation_job_items_output_idx";
--> statement-breakpoint
ALTER INDEX "public"."image_items_reconciler_idx" RENAME TO "generation_job_items_reconciler_idx";
--> statement-breakpoint
ALTER INDEX "public"."image_items_lease_idx" RENAME TO "generation_job_items_lease_idx";
--> statement-breakpoint
ALTER TABLE "public"."generation_jobs" RENAME CONSTRAINT "image_jobs_public_id_public_identifiers_value_fk" TO "generation_jobs_public_id_public_identifiers_value_fk";
--> statement-breakpoint
ALTER TABLE "public"."generation_jobs" RENAME CONSTRAINT "image_jobs_membership_fk" TO "generation_jobs_membership_fk";
--> statement-breakpoint
ALTER TABLE "public"."generation_jobs" RENAME CONSTRAINT "image_jobs_display_number_unique" TO "generation_jobs_display_number_unique";
--> statement-breakpoint
ALTER TABLE "public"."generation_jobs" RENAME CONSTRAINT "image_jobs_public_id_unique" TO "generation_jobs_public_id_unique";
--> statement-breakpoint
ALTER TABLE "public"."generation_jobs" RENAME CONSTRAINT "image_jobs_scope_key_unique" TO "generation_jobs_scope_key_unique";
--> statement-breakpoint
ALTER TABLE "public"."generation_jobs" RENAME CONSTRAINT "image_jobs_id_org_unique" TO "generation_jobs_id_org_unique";
--> statement-breakpoint
ALTER TABLE "public"."generation_jobs" RENAME CONSTRAINT "image_jobs_count_check" TO "generation_jobs_count_check";
--> statement-breakpoint
ALTER TABLE "public"."generation_jobs" RENAME CONSTRAINT "image_jobs_status_check" TO "generation_jobs_status_check";
--> statement-breakpoint
ALTER TABLE "public"."generation_jobs" RENAME CONSTRAINT "image_jobs_pkey" TO "generation_jobs_pkey";
--> statement-breakpoint
ALTER INDEX "public"."image_jobs_org_created_idx" RENAME TO "generation_jobs_org_created_idx";
--> statement-breakpoint
ALTER INDEX "public"."image_jobs_member_idx" RENAME TO "generation_jobs_member_idx";
--> statement-breakpoint
ALTER SEQUENCE "public"."image_jobs_display_number_seq" RENAME TO "generation_jobs_display_number_seq";
--> statement-breakpoint
ALTER TABLE "public"."generation_outbox" RENAME CONSTRAINT "image_outbox_item_id_image_job_items_id_fk" TO "generation_outbox_item_id_generation_job_items_id_fk";
--> statement-breakpoint
ALTER TABLE "public"."generation_outbox" RENAME CONSTRAINT "image_outbox_item_id_unique" TO "generation_outbox_item_id_unique";
--> statement-breakpoint
ALTER TABLE "public"."generation_outbox" RENAME CONSTRAINT "image_outbox_pkey" TO "generation_outbox_pkey";
--> statement-breakpoint
ALTER INDEX "public"."image_outbox_due_idx" RENAME TO "generation_outbox_due_idx";
--> statement-breakpoint
ALTER TABLE "public"."generation_retries" RENAME CONSTRAINT "image_retries_user_id_users_id_fk" TO "generation_retries_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "public"."generation_retries" RENAME CONSTRAINT "image_retries_job_org_fk" TO "generation_retries_job_org_fk";
--> statement-breakpoint
ALTER TABLE "public"."generation_retries" RENAME CONSTRAINT "image_retries_scope_key_unique" TO "generation_retries_scope_key_unique";
--> statement-breakpoint
ALTER TABLE "public"."generation_retries" RENAME CONSTRAINT "image_retries_pkey" TO "generation_retries_pkey";
--> statement-breakpoint
ALTER INDEX "public"."image_retries_job_idx" RENAME TO "generation_retries_job_idx";
--> statement-breakpoint
ALTER INDEX "public"."image_retries_user_idx" RENAME TO "generation_retries_user_idx";
--> statement-breakpoint
ALTER TABLE "public"."wallet_entries" RENAME CONSTRAINT "wallet_entries_job_id_image_jobs_id_fk" TO "wallet_entries_job_id_generation_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "public"."wallet_entries" RENAME CONSTRAINT "wallet_entries_item_id_image_job_items_id_fk" TO "wallet_entries_item_id_generation_job_items_id_fk";
--> statement-breakpoint
CREATE OR REPLACE FUNCTION validate_wallet_entry_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE org uuid;
BEGIN
 SELECT organization_id INTO org FROM organization_wallets WHERE id=NEW.wallet_id;
 IF NEW.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=org AND user_id=NEW.user_id)
 THEN RAISE EXCEPTION 'WALLET_MEMBER_MISMATCH'; END IF;
 IF NEW.kind IN ('consume','refund') AND NOT EXISTS (
  SELECT 1 FROM generation_jobs j JOIN generation_job_items i ON i.job_id=j.id
  WHERE j.id=NEW.job_id AND i.id=NEW.item_id AND j.organization_id=org AND j.user_id=NEW.user_id)
 THEN RAISE EXCEPTION 'WALLET_TASK_MISMATCH'; END IF;
 IF NEW.kind='recharge' AND NOT EXISTS (SELECT 1 FROM recharge_orders r WHERE r.id=NEW.recharge_id AND r.wallet_id=NEW.wallet_id AND r.user_id=NEW.user_id AND r.status='paid' AND r.credits=NEW.amount)
 THEN RAISE EXCEPTION 'WALLET_RECHARGE_MISMATCH'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE VIEW "public"."image_api_keys" WITH (security_invoker = true) AS
SELECT "id", "organization_id", "user_id", "token_hash", "expires_at", "revoked_at", "created_at" FROM "public"."generation_api_keys";
--> statement-breakpoint
CREATE VIEW "public"."image_credit_ledger" WITH (security_invoker = true) AS
SELECT "id", "organization_id", "job_id", "item_id", "event_type", "amount", "created_at" FROM "public"."generation_credit_ledger";
--> statement-breakpoint
CREATE VIEW "public"."image_job_items" WITH (security_invoker = true) AS
SELECT "id", "job_id", "organization_id", "position", "superseded_at", "status", "worker_id", "execution_token", "provider", "provider_request_id", "attempts", "output_asset_id", "error_code", "started_at", "completed_at", "lease_expires_at", "reconciled_by", "reconciliation_evidence", "created_at" FROM "public"."generation_job_items";
--> statement-breakpoint
CREATE VIEW "public"."image_jobs" WITH (security_invoker = true) AS
SELECT "id", "display_number", "public_id", "organization_id", "user_id", "idempotency_key", "input_hash", "input", "model", "provider_model", "prompt", "resolution", "aspect_ratio", "requested_count", "unit_credits", "status", "created_at", "updated_at", "completed_at" FROM "public"."generation_jobs";
--> statement-breakpoint
CREATE VIEW "public"."image_outbox" WITH (security_invoker = true) AS
SELECT "id", "item_id", "next_attempt_at", "lease_token", "lease_expires_at", "dispatched_at", "created_at" FROM "public"."generation_outbox";
--> statement-breakpoint
CREATE VIEW "public"."image_events" WITH (security_invoker = true) AS
SELECT "id", "organization_id", "kind", "resource_id", "created_at" FROM "public"."generation_events";
--> statement-breakpoint
CREATE VIEW "public"."image_retries" WITH (security_invoker = true) AS
SELECT "id", "organization_id", "user_id", "job_id", "idempotency_key", "created_at" FROM "public"."generation_retries";
