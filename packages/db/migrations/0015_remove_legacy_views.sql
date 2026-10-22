-- Contract the completed media/generation rename. Only views are removed;
-- RESTRICT aborts if a deployment still has dependent database objects.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
SET LOCAL statement_timeout = '30s';
--> statement-breakpoint
DROP VIEW "public"."image_assets", "public"."image_api_keys",
  "public"."image_jobs", "public"."image_job_items",
  "public"."image_outbox", "public"."image_retries",
  "public"."image_events", "public"."image_credit_ledger" RESTRICT;
