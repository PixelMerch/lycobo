CREATE TABLE "image_retries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "image_retries_scope_key_unique" UNIQUE("organization_id","user_id","idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "image_job_items" DROP CONSTRAINT "image_items_job_position_unique";--> statement-breakpoint
ALTER TABLE "image_job_items" ADD COLUMN "superseded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "image_retries" ADD CONSTRAINT "image_retries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_retries" ADD CONSTRAINT "image_retries_job_org_fk" FOREIGN KEY ("job_id","organization_id") REFERENCES "public"."image_jobs"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "image_retries_job_idx" ON "image_retries" USING btree ("job_id","organization_id");--> statement-breakpoint
CREATE INDEX "image_retries_user_idx" ON "image_retries" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "image_items_current_position_unique" ON "image_job_items" USING btree ("job_id","position") WHERE "image_job_items"."superseded_at" is null;