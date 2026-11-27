-- 旧任务保留空来源，短锁等待避免阻塞正在生成的任务。
SET LOCAL lock_timeout = '3s';--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "submission_source" text;
