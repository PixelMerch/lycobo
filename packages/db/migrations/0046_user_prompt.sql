-- 新列保留空值以兼容滚动发布中的旧写入端；空字符串表示用户没有填写正文。
SET LOCAL lock_timeout = '3s';--> statement-breakpoint
SET LOCAL statement_timeout = '15s';--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "user_prompt" text;--> statement-breakpoint
-- 仅回填图片任务，旧模型提示词和执行快照继续用于重试与生成。
UPDATE "generation_jobs"
SET "user_prompt" = CASE
  WHEN "input"->>'replica' = 'true' THEN
    CASE WHEN strpos("prompt", E'\n') > 0 THEN substr("prompt", strpos("prompt", E'\n') + 1) ELSE '' END
  WHEN "input" ? 'textileSet' THEN ''
  ELSE "prompt"
END
WHERE "user_prompt" IS NULL AND NOT ("input" ? 'video');
