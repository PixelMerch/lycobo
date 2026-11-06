CREATE TABLE "realtime_notification_reads" (
	"notification_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "realtime_notification_reads_notification_id_user_id_pk" PRIMARY KEY("notification_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "realtime_notification_reads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "realtime_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "realtime_notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "realtime_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" text NOT NULL,
	"user_id" uuid,
	"event" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "realtime_outbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "realtime_releases" (
	"version" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"published_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "realtime_releases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "realtime_notification_reads" ADD CONSTRAINT "realtime_notification_reads_notification_id_realtime_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."realtime_notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "realtime_notification_reads" ADD CONSTRAINT "realtime_notification_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "realtime_notifications" ADD CONSTRAINT "realtime_notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "realtime_notifications" ADD CONSTRAINT "realtime_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "realtime_outbox" ADD CONSTRAINT "realtime_outbox_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "realtime_notifications_org_created_idx" ON "realtime_notifications" USING btree ("organization_id","created_at","id");--> statement-breakpoint
CREATE INDEX "realtime_outbox_pending_idx" ON "realtime_outbox" USING btree ("created_at","id") WHERE "realtime_outbox"."delivered_at" is null;--> statement-breakpoint
-- 触发器保证所有写入渠道都先持久化事件，事务回滚不会产生虚假推送。
CREATE FUNCTION public.capture_realtime_event() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE org uuid; target uuid; event jsonb;
BEGIN
 IF TG_TABLE_NAME='generation_events' THEN
  org:=NEW.organization_id;
  event:=jsonb_build_object('id',gen_random_uuid(),'kind',NEW.kind,'resourceId',NEW.resource_id);
 ELSIF TG_TABLE_NAME='wallet_entries' THEN
  SELECT organization_id INTO org FROM organization_wallets WHERE id=NEW.wallet_id;
  event:=jsonb_build_object('id',gen_random_uuid(),'kind','wallet');
 ELSE
  org:=NEW.organization_id; target:=NEW.user_id;
  event:=jsonb_build_object('id',gen_random_uuid(),'kind','notification');
 END IF;
 INSERT INTO realtime_outbox(channel,user_id,event) VALUES(org::text,target,event);
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER generation_realtime_event AFTER INSERT ON generation_events
FOR EACH ROW EXECUTE FUNCTION public.capture_realtime_event();
--> statement-breakpoint
CREATE TRIGGER wallet_realtime_event AFTER INSERT ON wallet_entries
FOR EACH ROW EXECUTE FUNCTION public.capture_realtime_event();
--> statement-breakpoint
CREATE TRIGGER notification_realtime_event AFTER INSERT ON realtime_notifications
FOR EACH ROW EXECUTE FUNCTION public.capture_realtime_event();
--> statement-breakpoint
-- 只通知终态变化，不为旧任务生成历史消息，也不包含用户提示词。
CREATE FUNCTION public.capture_generation_notification() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('succeeded','partially_failed','failed') THEN
  INSERT INTO realtime_notifications(organization_id,user_id,title,body)
  VALUES(NEW.organization_id,NEW.user_id,
    CASE WHEN NEW.status='succeeded' THEN '图片生成完成' ELSE '图片任务已结束' END,
    '任务 '||NEW.public_id||' 已更新，可在工作台查看结果。');
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER generation_realtime_notification AFTER UPDATE OF status ON generation_jobs
FOR EACH ROW EXECUTE FUNCTION public.capture_generation_notification();
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.capture_realtime_event() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.capture_generation_notification() FROM PUBLIC;
--> statement-breakpoint
-- Supabase Data API 不承载业务访问，仅显式后端数据库连接可用。
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
  REVOKE ALL ON realtime_outbox,realtime_notifications,realtime_notification_reads,realtime_releases FROM anon;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
  REVOKE ALL ON realtime_outbox,realtime_notifications,realtime_notification_reads,realtime_releases FROM authenticated;
 END IF;
END $$;
