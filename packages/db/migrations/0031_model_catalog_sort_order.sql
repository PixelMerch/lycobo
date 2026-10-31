ALTER TABLE "model_catalog" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- Preserve the current catalog order for existing installations.
WITH ranked AS (SELECT code,(row_number() OVER (ORDER BY created_at,code) * 10)::integer AS position FROM model_catalog)
UPDATE model_catalog m SET sort_order=r.position FROM ranked r WHERE r.code=m.code;
