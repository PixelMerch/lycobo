CREATE TABLE "image_asset_favorites" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "image_asset_favorites_pk" PRIMARY KEY("organization_id","user_id","asset_id")
);
--> statement-breakpoint
ALTER TABLE "image_asset_favorites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "image_asset_favorites" ADD CONSTRAINT "image_asset_favorites_asset_org_fk" FOREIGN KEY ("asset_id","organization_id") REFERENCES "public"."media_assets"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_asset_favorites" ADD CONSTRAINT "image_asset_favorites_member_fk" FOREIGN KEY ("organization_id","user_id") REFERENCES "public"."organization_members"("organization_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "image_asset_favorites_recent_idx" ON "image_asset_favorites" USING btree ("organization_id","user_id","created_at" DESC NULLS LAST,"asset_id" DESC NULLS LAST);