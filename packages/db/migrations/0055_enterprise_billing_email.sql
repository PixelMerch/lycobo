-- 企业结账联系邮箱独立于登录凭据；短锁等待避免阻塞线上工作区请求。
SET LOCAL lock_timeout = '3s';--> statement-breakpoint
ALTER TABLE "organization_members" ADD COLUMN "billing_email" varchar(254);
