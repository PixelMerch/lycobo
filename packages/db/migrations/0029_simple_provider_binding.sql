ALTER TABLE "model_catalog" ADD COLUMN "provider_id" uuid;--> statement-breakpoint
ALTER TABLE "model_providers" ADD COLUMN "website_url" text;--> statement-breakpoint
ALTER TABLE "model_catalog" ADD CONSTRAINT "model_catalog_provider_id_model_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."model_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "model_catalog_provider_idx" ON "model_catalog" USING btree ("provider_id");
--> statement-breakpoint
-- Backfill only unambiguous bindings, without changing credentials or routes.
UPDATE model_catalog m SET provider_id=p.provider_id
FROM (SELECT model,min(provider_id::text)::uuid AS provider_id FROM model_channels
      GROUP BY model HAVING count(DISTINCT provider_id)=1) p
WHERE m.code=p.model AND m.provider_id IS NULL;
