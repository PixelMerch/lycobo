-- 旧账号保留空值，首次选择时才保存界面语言。
SET LOCAL lock_timeout = '3s';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferred_locale" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_preferred_locale_check" CHECK ("users"."preferred_locale" in ('zh-CN', 'en'));
