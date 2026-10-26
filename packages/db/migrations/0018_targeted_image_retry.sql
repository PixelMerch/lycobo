-- Bind single-image retry idempotency to its original item; NULL retains legacy whole-task retries.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "generation_retries" ADD COLUMN "target_item_id" uuid;--> statement-breakpoint
ALTER TABLE "generation_retries" ADD CONSTRAINT "generation_retries_target_item_id_generation_job_items_id_fk" FOREIGN KEY ("target_item_id") REFERENCES "public"."generation_job_items"("id") ON DELETE no action ON UPDATE no action;
