ALTER TABLE "media_assets" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "cleanup_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "storage_deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "media_assets_expiry_idx" ON "media_assets" USING btree ("expires_at") WHERE "media_assets"."expires_at" is not null and "media_assets"."storage_deleted_at" is null;