-- 旧 Key 保留空末四位，短锁等待避免阻塞正在进行的鉴权。
SET LOCAL lock_timeout = '3s';--> statement-breakpoint
ALTER TABLE "generation_api_keys" ADD COLUMN "key_suffix" text;
