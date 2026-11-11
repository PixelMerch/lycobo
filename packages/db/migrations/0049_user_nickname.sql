-- 只添加可空昵称，旧账号可继续使用原登录账号展示。
SET LOCAL lock_timeout = '3s';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "nickname" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_nickname_check" CHECK (char_length(btrim("users"."nickname")) between 1 and 64);
