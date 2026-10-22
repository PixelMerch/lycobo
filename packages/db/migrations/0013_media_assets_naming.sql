-- Rename in place: preserve every asset ID, row and incoming foreign key.
--> statement-breakpoint
ALTER TABLE "public"."image_assets" RENAME TO "media_assets";
--> statement-breakpoint
ALTER TABLE "public"."media_assets" RENAME CONSTRAINT "image_assets_pkey" TO "media_assets_pkey";
--> statement-breakpoint
ALTER TABLE "public"."media_assets" RENAME CONSTRAINT "image_assets_dimensions_check" TO "media_assets_dimensions_check";
--> statement-breakpoint
ALTER TABLE "public"."media_assets" RENAME CONSTRAINT "image_assets_display_number_unique" TO "media_assets_display_number_unique";
--> statement-breakpoint
ALTER TABLE "public"."media_assets" RENAME CONSTRAINT "image_assets_id_org_unique" TO "media_assets_id_org_unique";
--> statement-breakpoint
ALTER TABLE "public"."media_assets" RENAME CONSTRAINT "image_assets_kind_check" TO "media_assets_kind_check";
--> statement-breakpoint
ALTER TABLE "public"."media_assets" RENAME CONSTRAINT "image_assets_media_type_check" TO "media_assets_media_type_check";
--> statement-breakpoint
ALTER TABLE "public"."media_assets" RENAME CONSTRAINT "image_assets_membership_fk" TO "media_assets_membership_fk";
--> statement-breakpoint
ALTER TABLE "public"."media_assets" RENAME CONSTRAINT "image_assets_object_key_unique" TO "media_assets_object_key_unique";
--> statement-breakpoint
ALTER TABLE "public"."media_assets" RENAME CONSTRAINT "image_assets_public_id_public_identifiers_value_fk" TO "media_assets_public_id_public_identifiers_value_fk";
--> statement-breakpoint
ALTER TABLE "public"."media_assets" RENAME CONSTRAINT "image_assets_public_id_unique" TO "media_assets_public_id_unique";
--> statement-breakpoint
ALTER INDEX "public"."image_assets_org_created_idx" RENAME TO "media_assets_org_created_idx";
--> statement-breakpoint
ALTER INDEX "public"."image_assets_member_idx" RENAME TO "media_assets_member_idx";
--> statement-breakpoint
ALTER SEQUENCE "public"."image_assets_display_number_seq" RENAME TO "media_assets_display_number_seq";
--> statement-breakpoint
-- Compatibility for previously deployed image API/Worker versions. This simple
-- view supports their SELECT and INSERT ... RETURNING statements. New code uses
-- media_assets. Remove only in a later migration after old versions are retired.
CREATE VIEW "public"."image_assets" WITH (security_invoker = true) AS
SELECT "id", "organization_id", "user_id", "kind", "object_key", "mime_type",
       "width", "height", "bytes", "sha256", "created_at", "display_number",
       "public_id", "media_type"
FROM "public"."media_assets";
