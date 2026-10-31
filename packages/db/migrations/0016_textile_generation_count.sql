-- Expand existing paid tasks to ten angle-specific textile outputs; generic inputs remain limited to four by contracts.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "generation_jobs" DROP CONSTRAINT "generation_jobs_count_check";--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_count_check" CHECK ("generation_jobs"."requested_count" between 1 and 10 and "generation_jobs"."unit_credits" > 0 and ("generation_jobs"."requested_count" <= 4 or "generation_jobs"."input" ? 'textileSet'));
