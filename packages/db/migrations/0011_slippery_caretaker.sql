CREATE TABLE "image_local_edits" (
	"job_id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"source_asset_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "image_local_edits" ADD CONSTRAINT "image_local_edits_job_org_fk" FOREIGN KEY ("job_id","organization_id") REFERENCES "public"."image_jobs"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_local_edits" ADD CONSTRAINT "image_local_edits_source_org_fk" FOREIGN KEY ("source_asset_id","organization_id") REFERENCES "public"."image_assets"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_local_edits" ADD CONSTRAINT "image_local_edits_member_fk" FOREIGN KEY ("organization_id","user_id") REFERENCES "public"."organization_members"("organization_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "image_local_edits_latest_idx" ON "image_local_edits" USING btree ("organization_id","user_id","source_asset_id","created_at" DESC NULLS LAST,"job_id" DESC NULLS LAST);