-- 避免索引构建长时间等待线上生成任务写锁。
SET LOCAL lock_timeout = '3s';--> statement-breakpoint
CREATE INDEX "generation_jobs_running_image_member_idx" ON "generation_jobs" USING btree ("organization_id","user_id") WHERE "generation_jobs"."status" = 'running' and not ("generation_jobs"."input" ? 'video');
