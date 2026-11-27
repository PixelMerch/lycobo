-- 原文件指纹仅用于当前成员和工作区的自动化参考图查重。
SET LOCAL lock_timeout = '3s';--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "source_sha256" text;--> statement-breakpoint
CREATE INDEX "media_assets_source_sha256_idx" ON "media_assets" USING btree ("organization_id","user_id","source_sha256") WHERE "media_assets"."source_sha256" is not null and "media_assets"."storage_deleted_at" is null and "media_assets"."cleanup_started_at" is null;
