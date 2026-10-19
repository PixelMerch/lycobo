CREATE TABLE "image_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "image_api_keys_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "image_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"object_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "image_assets_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "image_assets_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "image_assets_dimensions_check" CHECK ("image_assets"."width" > 0 and "image_assets"."height" > 0 and "image_assets"."bytes" > 0),
	CONSTRAINT "image_assets_kind_check" CHECK ("image_assets"."kind" in ('reference','output'))
);
--> statement-breakpoint
CREATE TABLE "image_credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"item_id" uuid,
	"event_type" text NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "image_ledger_amount_check" CHECK (("image_credit_ledger"."event_type" = 'reserve' and "image_credit_ledger"."amount" < 0) or ("image_credit_ledger"."event_type" = 'refund' and "image_credit_ledger"."amount" > 0))
);
--> statement-breakpoint
CREATE TABLE "image_job_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"worker_id" text,
	"execution_token" uuid,
	"provider" text DEFAULT 'vakv' NOT NULL,
	"provider_request_id" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"output_asset_id" uuid,
	"error_code" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"lease_expires_at" timestamp with time zone,
	"reconciled_by" uuid,
	"reconciliation_evidence" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "image_items_job_position_unique" UNIQUE("job_id","position"),
	CONSTRAINT "image_items_position_check" CHECK ("image_job_items"."position" between 0 and 3 and "image_job_items"."attempts" >= 0),
	CONSTRAINT "image_items_status_check" CHECK ("image_job_items"."status" in ('queued','running','succeeded','failed','needs_reconciliation')),
	CONSTRAINT "image_items_output_check" CHECK ("image_job_items"."status" <> 'succeeded' or "image_job_items"."output_asset_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "image_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"input_hash" text NOT NULL,
	"input" jsonb NOT NULL,
	"model" text NOT NULL,
	"prompt" text NOT NULL,
	"resolution" text NOT NULL,
	"aspect_ratio" text NOT NULL,
	"requested_count" integer NOT NULL,
	"unit_credits" integer NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "image_jobs_scope_key_unique" UNIQUE("organization_id","user_id","idempotency_key"),
	CONSTRAINT "image_jobs_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "image_jobs_count_check" CHECK ("image_jobs"."requested_count" between 1 and 4 and "image_jobs"."unit_credits" > 0),
	CONSTRAINT "image_jobs_status_check" CHECK ("image_jobs"."status" in ('queued','running','succeeded','partially_failed','failed','needs_reconciliation'))
);
--> statement-breakpoint
CREATE TABLE "image_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_token" uuid,
	"lease_expires_at" timestamp with time zone,
	"dispatched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "image_outbox_item_id_unique" UNIQUE("item_id")
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_members_org_user_unique" UNIQUE("organization_id","user_id"),
	CONSTRAINT "organization_members_role_check" CHECK ("organization_members"."role" in ('admin','member'))
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"available_credits" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_credits_nonnegative" CHECK ("organizations"."available_credits" >= 0)
);
--> statement-breakpoint
ALTER TABLE "image_api_keys" ADD CONSTRAINT "image_keys_membership_fk" FOREIGN KEY ("organization_id","user_id") REFERENCES "public"."organization_members"("organization_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_membership_fk" FOREIGN KEY ("organization_id","user_id") REFERENCES "public"."organization_members"("organization_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_credit_ledger" ADD CONSTRAINT "image_credit_ledger_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_credit_ledger" ADD CONSTRAINT "image_credit_ledger_item_id_image_job_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."image_job_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_credit_ledger" ADD CONSTRAINT "image_ledger_job_org_fk" FOREIGN KEY ("job_id","organization_id") REFERENCES "public"."image_jobs"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_job_items" ADD CONSTRAINT "image_job_items_reconciled_by_users_id_fk" FOREIGN KEY ("reconciled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_job_items" ADD CONSTRAINT "image_items_job_org_fk" FOREIGN KEY ("job_id","organization_id") REFERENCES "public"."image_jobs"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_job_items" ADD CONSTRAINT "image_items_output_org_fk" FOREIGN KEY ("output_asset_id","organization_id") REFERENCES "public"."image_assets"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_jobs" ADD CONSTRAINT "image_jobs_membership_fk" FOREIGN KEY ("organization_id","user_id") REFERENCES "public"."organization_members"("organization_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_outbox" ADD CONSTRAINT "image_outbox_item_id_image_job_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."image_job_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "image_keys_member_idx" ON "image_api_keys" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "image_assets_org_created_idx" ON "image_assets" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "image_assets_member_idx" ON "image_assets" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "image_ledger_refund_unique" ON "image_credit_ledger" USING btree ("item_id") WHERE "image_credit_ledger"."event_type" = 'refund';--> statement-breakpoint
CREATE UNIQUE INDEX "image_ledger_reserve_unique" ON "image_credit_ledger" USING btree ("job_id") WHERE "image_credit_ledger"."event_type" = 'reserve';--> statement-breakpoint
CREATE INDEX "image_ledger_org_created_idx" ON "image_credit_ledger" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "image_ledger_job_idx" ON "image_credit_ledger" USING btree ("job_id","organization_id");--> statement-breakpoint
CREATE INDEX "image_items_output_idx" ON "image_job_items" USING btree ("output_asset_id","organization_id");--> statement-breakpoint
CREATE INDEX "image_items_reconciler_idx" ON "image_job_items" USING btree ("reconciled_by");--> statement-breakpoint
CREATE INDEX "image_items_lease_idx" ON "image_job_items" USING btree ("lease_expires_at") WHERE "image_job_items"."status" = 'running';--> statement-breakpoint
CREATE INDEX "image_jobs_org_created_idx" ON "image_jobs" USING btree ("organization_id","created_at","id");--> statement-breakpoint
CREATE INDEX "image_jobs_member_idx" ON "image_jobs" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "image_outbox_due_idx" ON "image_outbox" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE INDEX "organization_members_user_idx" ON "organization_members" USING btree ("user_id");