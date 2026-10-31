CREATE TABLE "model_catalog" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_catalog_id_unique" UNIQUE("id"),
	CONSTRAINT "model_catalog_category_check" CHECK ("model_catalog"."category" in ('image','music','video'))
);
--> statement-breakpoint
ALTER TABLE "model_catalog" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "model_provider_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"credential_id" uuid NOT NULL,
	"name" text NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_provider_keys_provider_name_unique" UNIQUE("provider_id","name")
);
--> statement-breakpoint
ALTER TABLE "model_provider_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "model_channels" ADD COLUMN "key_id" uuid;--> statement-breakpoint
ALTER TABLE "model_provider_keys" ADD CONSTRAINT "model_provider_keys_provider_id_model_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."model_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_provider_keys" ADD CONSTRAINT "model_provider_keys_credential_id_model_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."model_credentials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "model_provider_keys_credential_idx" ON "model_provider_keys" USING btree ("credential_id");--> statement-breakpoint
-- Preserve existing image configurations and immutable credential versions.
INSERT INTO model_catalog(code,name,category,enabled) VALUES
('gpt-image-2','GPT Image 2','image',1),
('gpt-image-2.5','GPT Image 2.5','image',1),
('nano-banana-2.1','Nano Banana 2.1','image',1)
ON CONFLICT(code) DO NOTHING;
--> statement-breakpoint
INSERT INTO model_catalog(code,name,category,enabled)
SELECT DISTINCT model,model,'image',1 FROM model_channels ON CONFLICT(code) DO NOTHING;
--> statement-breakpoint
INSERT INTO model_provider_keys(provider_id,credential_id,name,enabled)
SELECT id,credential_id,'默认密钥',1 FROM model_providers;
--> statement-breakpoint
UPDATE model_channels c SET key_id=k.id FROM model_provider_keys k
WHERE k.provider_id=c.provider_id AND c.key_id IS NULL;
--> statement-breakpoint
ALTER TABLE "model_channels" ADD CONSTRAINT "model_channels_model_model_catalog_code_fk" FOREIGN KEY ("model") REFERENCES "public"."model_catalog"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_channels" ADD CONSTRAINT "model_channels_key_id_model_provider_keys_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."model_provider_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "model_channels_key_idx" ON "model_channels" USING btree ("key_id");--> statement-breakpoint
CREATE INDEX "model_channels_model_idx" ON "model_channels" USING btree ("model");